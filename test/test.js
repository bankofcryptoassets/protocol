const { ethers } = require("hardhat");
const { expect } = require("chai");
const { parseUnits, formatUnits } = ethers;

describe("LendingPool", function () {
  let deployer, lender1, lender2, borrower1, borrower2;
  let mockDeployer, lendingPool;
  let usdc, cbBtc, aavePool, swapRouter, oracle;
  let addresses;

  beforeEach(async function () {
    console.log("Setting up test environment...");
    
    // Get signers
    [deployer, lender1, lender2, borrower1, borrower2] = await ethers.getSigners();
    
    // Deploy MockDeployer
    const MockDeployer = await ethers.getContractFactory("MockDeployer");
    mockDeployer = await MockDeployer.deploy();
    await mockDeployer.waitForDeployment();
    
    // Deploy and initialize mock contracts
    await mockDeployer.deploy();
    await mockDeployer.initialize();
    
    // Get contract addresses
    addresses = await mockDeployer.getAddresses();
    
    // Get contract instances
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const MockCbBTC = await ethers.getContractFactory("MockCbBTC");
    const MockAavePool = await ethers.getContractFactory("MockAavePool");
    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    const MockOracle = await ethers.getContractFactory("MockBTCPriceOracle");
    
    usdc = MockUSDC.attach(addresses[0]);
    cbBtc = MockCbBTC.attach(addresses[1]);
    aavePool = MockAavePool.attach(addresses[2]);
    swapRouter = MockSwapRouter.attach(addresses[3]);
    oracle = MockOracle.attach(addresses[4]);
    
    // Deploy LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(
      addresses[0], // USDC
      addresses[1], // cbBTC
      addresses[4], // Oracle
      addresses[2], // Aave Pool
      addresses[3]  // Swap Router
    );
    await lendingPool.waitForDeployment();
    
    // Mint tokens for deployer (for liquidity)
    await mockDeployer.mintTestTokens(
      deployer.address,
      parseUnits("50000000", 6), // 50M USDC
      parseUnits("500", 8)       // 500 BTC
    );
    
    // Add liquidity to swap router
    await usdc.connect(deployer).transfer(addresses[3], parseUnits("10000000", 6));
    await cbBtc.connect(deployer).transfer(addresses[3], parseUnits("100", 8));
    
    // Mint tokens for test accounts
    await mockDeployer.mintTestTokens(lender1.address, parseUnits("200000", 6), 0);
    await mockDeployer.mintTestTokens(lender2.address, parseUnits("200000", 6), 0);
    await mockDeployer.mintTestTokens(borrower1.address, parseUnits("100000", 6), 0);
    await mockDeployer.mintTestTokens(borrower2.address, parseUnits("100000", 6), 0);
    
    console.log("Test environment setup complete");
  });

  describe("Pool Operations", function () {
    it("Should allow lenders to deposit to pool", async function () {
      const depositAmount = parseUnits("50000", 6);
      
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), depositAmount);
      await lendingPool.connect(lender1).depositToPool(depositAmount);
      
      const poolBalance = await lendingPool.lenderPoolBalance(lender1.address);
      const totalPool = await lendingPool.totalPoolBalance();
      
      expect(poolBalance).to.equal(depositAmount);
      expect(totalPool).to.equal(depositAmount);
      
      console.log(`Lender1 deposited ${formatUnits(depositAmount, 6)} USDC to pool`);
    });

    it("Should allow lenders to withdraw from pool", async function () {
      const depositAmount = parseUnits("50000", 6);
      const withdrawAmount = parseUnits("20000", 6);
      
      // Deposit first
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), depositAmount);
      await lendingPool.connect(lender1).depositToPool(depositAmount);
      
      // Withdraw
      await lendingPool.connect(lender1).withdrawFromPool(withdrawAmount);
      
      const poolBalance = await lendingPool.lenderPoolBalance(lender1.address);
      const totalPool = await lendingPool.totalPoolBalance();
      
      expect(poolBalance).to.equal(depositAmount - withdrawAmount);
      expect(totalPool).to.equal(depositAmount - withdrawAmount);
      
      console.log(`Lender1 withdrew ${formatUnits(withdrawAmount, 6)} USDC from pool`);
    });

    it("Should not allow withdrawal of more than deposited", async function () {
      const depositAmount = parseUnits("50000", 6);
      const withdrawAmount = parseUnits("60000", 6);
      
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), depositAmount);
      await lendingPool.connect(lender1).depositToPool(depositAmount);
      
      await expect(
        lendingPool.connect(lender1).withdrawFromPool(withdrawAmount)
      ).to.be.revertedWith("Insufficient pool balance");
    });
  });

  describe("Loan Creation", function () {
    beforeEach(async function () {
      // Set up pool liquidity
      const poolAmount = parseUnits("500000", 6);
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), poolAmount);
      await lendingPool.connect(lender1).depositToPool(poolAmount);
    });

    it("Should create a loan with valid parameters", async function () {
      const totalAmount = parseUnits("100000", 6);
      const downPaymentBps = 4000; // 40%
      const borrowerDeposit = (totalAmount * BigInt(downPaymentBps)) / 10000n;
      
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), borrowerDeposit);
      
      const tx = await lendingPool.connect(borrower1).loan(
        totalAmount,
        18, // 18 months
        15, // 15% annual interest
        downPaymentBps
      );
      
      await tx.wait();
      
      const hasActiveLoan = await lendingPool.hasActiveLoan(borrower1.address);
      expect(hasActiveLoan).to.be.true;
      
      console.log(`Created loan for ${formatUnits(totalAmount, 6)} USDC with ${formatUnits(borrowerDeposit, 6)} USDC deposit`);
    });

    it("Should reject loan with invalid down payment percentage", async function () {
      const totalAmount = parseUnits("100000", 6);
      const invalidDownPaymentBps = 1000; // 10% - below minimum
      
      await expect(
        lendingPool.connect(borrower1).loan(
          totalAmount,
          18,
          15,
          invalidDownPaymentBps
        )
      ).to.be.revertedWith("Down payment must be between 20% and 50%");
    });

    it("Should reject loan if insufficient pool liquidity", async function () {
      const totalAmount = parseUnits("1000000", 6); // 1M USDC - more than pool
      const downPaymentBps = 4000;
      const borrowerDeposit = (totalAmount * BigInt(downPaymentBps)) / 10000n;
      
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), borrowerDeposit);
      
      await expect(
        lendingPool.connect(borrower1).loan(totalAmount, 18, 15, downPaymentBps)
      ).to.be.revertedWith("Insufficient pool liquidity");
    });
  });

  describe("Loan Repayment", function () {
    let loanId;
    const totalAmount = parseUnits("100000", 6);
    const downPaymentBps = 4000;
    
    beforeEach(async function () {
      // Set up pool and create loan
      const poolAmount = parseUnits("500000", 6);
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), poolAmount);
      await lendingPool.connect(lender1).depositToPool(poolAmount);
      
      const borrowerDeposit = (totalAmount * BigInt(downPaymentBps)) / 10000n;
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), borrowerDeposit);
      
      const tx = await lendingPool.connect(borrower1).loan(totalAmount, 18, 15, downPaymentBps);
      const receipt = await tx.wait();
      
      // Generate loan ID
      const latestBlock = await ethers.provider.getBlock(receipt.blockNumber);
      loanId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256"],
          [borrower1.address, latestBlock.timestamp]
        )
      );
    });

    it("Should allow borrower to make repayments", async function () {
      const repaymentAmount = parseUnits("10000", 6);
      
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), repaymentAmount);
      
      const tx = await lendingPool.connect(borrower1).payouts(loanId, repaymentAmount);
      await tx.wait();
      
      console.log(`Borrower repaid ${formatUnits(repaymentAmount, 6)} USDC`);
      
      // Check that some installments are marked as paid
      const [principals, interests, paidStatuses] = await lendingPool.getAmortizationSchedule(loanId);
      const paidCount = paidStatuses.filter(paid => paid).length;
      
      expect(paidCount).to.be.greaterThan(0);
      console.log(`${paidCount} installments marked as paid`);
    });

    it("Should unstake proportional cbBTC on repayment", async function () {
      const stakedBefore = await lendingPool.getStakedAmount(loanId);
      console.log(`Staked before repayment: ${formatUnits(stakedBefore, 8)} cbBTC`);
      
      const repaymentAmount = parseUnits("10000", 6);
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), repaymentAmount);
      
      await lendingPool.connect(borrower1).payouts(loanId, repaymentAmount);
      
      const stakedAfter = await lendingPool.getStakedAmount(loanId);
      console.log(`Staked after repayment: ${formatUnits(stakedAfter, 8)} cbBTC`);
      
      expect(stakedAfter).to.be.lessThan(stakedBefore);
    });

    it("Should not allow non-borrower to make repayments", async function () {
      const repaymentAmount = parseUnits("10000", 6);
      
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), repaymentAmount);
      
      await expect(
        lendingPool.connect(lender1).payouts(loanId, repaymentAmount)
      ).to.be.revertedWith("Only borrower can repay");
    });
  });

  describe("Liquidation", function () {
    let loanId;
    const totalAmount = parseUnits("100000", 6);
    const downPaymentBps = 2000;
    
    beforeEach(async function () {
      // Set up pool and create loan
      const poolAmount = parseUnits("500000", 6);
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), poolAmount);
      await lendingPool.connect(lender1).depositToPool(poolAmount);
      
      const borrowerDeposit = (totalAmount * BigInt(downPaymentBps)) / 10000n;
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), borrowerDeposit);
      
      const tx = await lendingPool.connect(borrower1).loan(totalAmount, 18, 15, downPaymentBps);
      const receipt = await tx.wait();
      
      const latestBlock = await ethers.provider.getBlock(receipt.blockNumber);
      loanId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256"],
          [borrower1.address, latestBlock.timestamp]
        )
      );
    });

    it("Should liquidate loan when BTC price drops significantly", async function () {
      // Simulate BTC price drop by updating oracle
      const MockOracle = await ethers.getContractFactory("MockBTCPriceOracle");
      const newOracle = await MockOracle.deploy();
      await newOracle.waitForDeployment();
      
      // Set a much lower BTC price
      await newOracle.setPrice(parseUnits("50000", 8)); // $50k instead of $100k
      await lendingPool.setChainlinkOracle(await newOracle.getAddress());
      
      const tx = await lendingPool.connect(deployer).liquidate(loanId);
      await tx.wait();
      
      const hasActiveLoan = await lendingPool.hasActiveLoan(borrower1.address);
      expect(hasActiveLoan).to.be.false;
      
      console.log("Loan liquidated due to BTC price drop");
    });

    it("Should not liquidate loan when BTC price is above threshold", async function () {
      await expect(
        lendingPool.connect(deployer).liquidate(loanId)
      ).to.be.revertedWith("BTC value has not dropped below liquidation threshold");
    });

    it("Should only allow owner to liquidate", async function () {
      await expect(
        lendingPool.connect(borrower1).liquidate(loanId)
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Utility Functions", function () {
    it("Should compute loan parts correctly", async function () {
      const totalAmount = parseUnits("100000", 6);
      const [borrowerDeposit, lenderPrincipal] = await lendingPool.computeLoanParts(totalAmount);
      
      expect(borrowerDeposit).to.equal(parseUnits("20000", 6)); // 20%
      expect(lenderPrincipal).to.equal(parseUnits("80000", 6)); // 80%
      
      console.log(`For ${formatUnits(totalAmount, 6)} USDC loan:`);
      console.log(`Borrower deposit: ${formatUnits(borrowerDeposit, 6)} USDC`);
      console.log(`Lender principal: ${formatUnits(lenderPrincipal, 6)} USDC`);
    });

    it("Should validate down payment percentage", async function () {
      const totalAmount = parseUnits("100000", 6);
      const borrowerDeposit = parseUnits("25000", 6); // 25%
      
      const [downPaymentBps, isValid] = await lendingPool.getDownPaymentBasisPoints(totalAmount, borrowerDeposit);
      
      expect(downPaymentBps).to.equal(2500); // 25% = 2500 basis points
      expect(isValid).to.be.true;
      
      console.log(`Down payment: ${downPaymentBps} basis points (${downPaymentBps/100}%)`);
    });

    it("Should get loan requirements correctly", async function () {
      const totalAmount = parseUnits("100000", 6);
      const downPaymentPercentage = 3000; // 30%
      
      const [borrowerDeposit, lenderPrincipal, isValid] = await lendingPool.getLoanRequirements(totalAmount, downPaymentPercentage);
      
      expect(borrowerDeposit).to.equal(parseUnits("30000", 6));
      expect(lenderPrincipal).to.equal(parseUnits("70000", 6));
      expect(isValid).to.be.true;
      
      console.log(`30% down payment on ${formatUnits(totalAmount, 6)} USDC:`);
      console.log(`Borrower deposit: ${formatUnits(borrowerDeposit, 6)} USDC`);
      console.log(`Lender principal: ${formatUnits(lenderPrincipal, 6)} USDC`);
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to set fees", async function () {
      await lendingPool.connect(deployer).setOriginationFee(100); // 1%
      await lendingPool.connect(deployer).setEarlyClosureFee(200); // 2%
      await lendingPool.connect(deployer).setMissedPaymentFee(300); // 3%
      
      console.log("Fees set successfully");
    });

    it("Should reject fees above 100%", async function () {
      await expect(
        lendingPool.connect(deployer).setOriginationFee(15000) // 150%
      ).to.be.revertedWith("Fee too high");
    });

    it("Should only allow owner to set fees", async function () {
      await expect(
        lendingPool.connect(borrower1).setOriginationFee(100)
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Price Oracle", function () {
    it("Should get current BTC price", async function () {
      const price = await lendingPool.getPrice();
      expect(price).to.be.greaterThan(0);
      
      console.log(`Current BTC price: $${formatUnits(price, 8)}`);
    });

    it("Should allow owner to update oracle address", async function () {
      const MockOracle = await ethers.getContractFactory("MockBTCPriceOracle");
      const newOracle = await MockOracle.deploy();
      await newOracle.waitForDeployment();
      
      await lendingPool.connect(deployer).setChainlinkOracle(await newOracle.getAddress());
      
      console.log("Oracle address updated successfully");
    });
  });

  describe("Integration Test", function () {
    it("Should handle complete loan lifecycle", async function () {
      console.log("Starting complete loan lifecycle test...");
      
      // 1. Set up pool liquidity
      const poolAmount = parseUnits("500000", 6);
      await usdc.connect(lender1).approve(await lendingPool.getAddress(), poolAmount);
      await lendingPool.connect(lender1).depositToPool(poolAmount);
      console.log(`Pool funded with ${formatUnits(poolAmount, 6)} USDC`);
      
      // 2. Create loan
      const totalAmount = parseUnits("100000", 6);
      const downPaymentBps = 2500; // 25%
      const borrowerDeposit = (totalAmount * BigInt(downPaymentBps)) / 10000n;
      
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), borrowerDeposit);
      const loanTx = await lendingPool.connect(borrower1).loan(totalAmount, 12, 12, downPaymentBps);
      const loanReceipt = await loanTx.wait();
      
      const latestBlock = await ethers.provider.getBlock(loanReceipt.blockNumber);
      const loanId = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256"],
          [borrower1.address, latestBlock.timestamp]
        )
      );
      
      console.log(`Loan created with ID: ${loanId}`);
      console.log(`Borrower deposit: ${formatUnits(borrowerDeposit, 6)} USDC`);
      
      // 3. Check amortization schedule
      const [principals, interests, paidStatuses] = await lendingPool.getAmortizationSchedule(loanId);
      console.log(`Loan has ${principals.length} installments`);
      console.log(`First installment: ${formatUnits(principals[0], 6)} USDC principal + ${formatUnits(interests[0], 6)} USDC interest`);
      
      // 4. Make partial repayment
      const repaymentAmount = parseUnits("15000", 6);
      await usdc.connect(borrower1).approve(await lendingPool.getAddress(), repaymentAmount);
      await lendingPool.connect(borrower1).payouts(loanId, repaymentAmount);
      console.log(`Repayment of ${formatUnits(repaymentAmount, 6)} USDC made`);
      
      // 5. Check updated status
      const [, , updatedPaidStatuses] = await lendingPool.getAmortizationSchedule(loanId);
      const paidCount = updatedPaidStatuses.filter(paid => paid).length;
      console.log(`${paidCount} installments now paid`);
      
      // 6. Check staked amount
      const stakedAmount = await lendingPool.getStakedAmount(loanId);
      console.log(`Remaining staked: ${formatUnits(stakedAmount, 8)} cbBTC`);
      
      console.log("Complete loan lifecycle test passed! 🎉");
    });
  });
});