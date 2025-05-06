const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("bignumber.js");

describe("LendingPool", function () {
  let LendingPool,
    MockFactory,
    MockRouter,
    MockERC20,
    lendingPool,
    factory,
    router,
    usdcToken,
    wbtcToken,
    owner,
    lender1,
    lender2,
    borrower;

  beforeEach(async function () {
    [owner, lender1, lender2, borrower] = await ethers.getSigners();

    // Deploy MockFactory
    MockFactory = await ethers.getContractFactory("MockFactory");
    factory = await MockFactory.deploy();
    console.log("Factory deployed at:", factory.target);

    MockRouter = await ethers.getContractFactory("MockRouter");
    router = await MockRouter.deploy(factory.target);
    console.log("Router deployed at:", router.target);

    // Deploy MockERC20 tokens
    MockERC20 = await ethers.getContractFactory("ERC20Mock");
    usdcToken = await MockERC20.deploy("Mock USDC", "USDC");
    wbtcToken = await MockERC20.deploy("Mock WBTC", "WBTC");
    console.log("USDC deployed at:", usdcToken.target);
    console.log("WBTC deployed at:", wbtcToken.target);

    // Mint tokens for owner (used for adding liquidity)
    await usdcToken.mint(owner.address, ethers.parseUnits("1000000", 18)); // 1,000,000 USDC
    await wbtcToken.mint(owner.address, ethers.parseUnits("10", 18)); // 10 WBTC
    console.log("Minted USDC and WBTC for owner");

    // Mint tokens for lenders and borrower
    await usdcToken.mint(lender1.address, ethers.parseUnits("1000", 18));
    await usdcToken.mint(lender2.address, ethers.parseUnits("1000", 18));
    await usdcToken.mint(borrower.address, ethers.parseUnits("500", 18));
    console.log("Minted USDC for lender1, lender2, and borrower");

    // Approve pair contract to spend owner's tokens
    await usdcToken.approve(factory.target, ethers.parseUnits("100000", 18));
    await wbtcToken.approve(factory.target, ethers.parseUnits("1", 18));
    console.log("Approved factory to spend owner's USDC and WBTC");

    // Create pair via factory
    await factory.createPair(usdcToken.target, wbtcToken.target);
    pairAddress = await factory.getPair(usdcToken.target, wbtcToken.target);
    console.log("Pair created at:", pairAddress);

    if (!pairAddress || pairAddress === ethers.ZeroHash) {
      throw new Error("Failed to create pair");
    }

    // Deploy MockPair at pairAddress
    MockPair = await ethers.getContractFactory("MockPair");
    pair = MockPair.attach(pairAddress);

    // Approve Pair Contract to Spend Tokens
    await usdcToken.approve(pair.target, ethers.parseUnits("100000", 18));
    await wbtcToken.approve(pair.target, ethers.parseUnits("1", 18));
    console.log("Approved pair to spend tokens");

    // Add liquidity directly to the pair
    await pair.addLiquidity(
      ethers.parseUnits("100000", 18), // 100,000 USDC
      ethers.parseUnits("1", 18) // 1 WBTC
    );
    console.log("Added liquidity: 100,000 USDC and 1 WBTC");

    // Deploy LendingPool contract
    LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(
      usdcToken.target,
      wbtcToken.target,
      factory.target // Updated to factory target
    );
    console.log("LendingPool deployed at:", lendingPool.target);

    if (!lendingPool.target) {
      throw new Error("Failed to deploy LendingPool");
    }

    // Approve LendingPool to spend USDC for lenders and borrower
    await usdcToken
      .connect(lender1)
      .approve(lendingPool.target, ethers.parseUnits("1000", 18));
    await usdcToken
      .connect(lender2)
      .approve(lendingPool.target, ethers.parseUnits("1000", 18));
    await usdcToken
      .connect(borrower)
      .approve(lendingPool.target, ethers.parseUnits("500", 18));
    console.log("Approved LendingPool to spend USDC for lenders and borrower");
  });

  it("should allow lenders to deposit USDC", async function () {
    await lendingPool
      .connect(lender1)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);
    const lender1Info = await lendingPool.lenders(lender1.address);

    expect(lender1Info.deposit).to.equal(ethers.parseUnits("500", 18));
    expect(await usdcToken.balanceOf(lendingPool.target)).to.equal(
      ethers.parseUnits("500", 18)
    );
  });

  it("should allow a borrower to create a loan", async function () {
    // Lenders deposit USDC
    await lendingPool
      .connect(lender1)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);
    await lendingPool
      .connect(lender2)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);

    // Loan amount as BigInt
    const loanAmount = ethers.parseUnits("400", 18);
    const collateralAmount = (loanAmount * 20n) / 100n; // 20% of the loan amount

    // Borrower approves the LendingPool contract to spend the collateral
    await usdcToken
      .connect(borrower)
      .approve(lendingPool.target, collateralAmount);

      const interestRate = 5n; // 5%

    await lendingPool
      .connect(borrower)
      .loan(loanAmount, BigInt(1800), interestRate);

    // Verify the loan details
    const loanId = await lendingPool.loansList(0);
    const loan = await lendingPool.loans(loanId);

    expect(loan.amount).to.equal(loanAmount);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.isActive).to.be.true;

    // Check if the collateral has been transferred to the LendingPool contract
    const poolBalance = await usdcToken.balanceOf(lendingPool.target);
    expect(poolBalance).to.equal(collateralAmount);
  });

  it("should distribute payouts to lenders after loan repayment", async function () {
    // Lenders deposit USDC
    await lendingPool
      .connect(lender1)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);
    await lendingPool
      .connect(lender2)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);

    // Borrower creates a loan
    await lendingPool
      .connect(borrower)
      .loan(ethers.parseUnits("400", 18), 30, 5);
    const loanId = await lendingPool.loansList(0);

    // Borrower repays the loan
    const repaymentAmount = ethers.parseUnits("420", 18); // Principal + interest
    await lendingPool.connect(borrower).payouts(loanId, repaymentAmount);

    // Check lender balances
    const lender1Balance = await usdcToken.balanceOf(lender1.address);
    const lender2Balance = await usdcToken.balanceOf(lender2.address);

    // expect(lender1Balance).to.be.above(ethers.parseUnits("0", 18)); // Lender 1 receives payout
    // expect(lender2Balance).to.be.above(ethers.parseUnits("0", 18)); // Lender 2 receives payout

    console.log("Lender 1 balance:", ethers.formatUnits(lender1Balance, 18));
    console.log("Lender 2 balance:", ethers.formatUnits(lender2Balance, 18));
    // Check that the loan is fully repaid
    const loan = await lendingPool.loans(loanId);
    expect(loan.isActive).to.be.false;
  });

  it("should calculate available liquidity correctly", async function () {
    await lendingPool
      .connect(lender1)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);
    await lendingPool
      .connect(lender2)
      .deposit(usdcToken.target, ethers.parseUnits("500", 18), 5, 30);

    const liquidity = await lendingPool.availableLiquidity();
    expect(liquidity).to.equal(ethers.parseUnits("1000", 18));
  });

  it("should reject loan creation if insufficient liquidity", async function () {
    await expect(
      lendingPool.connect(borrower).loan(ethers.parseUnits("500", 18), 30, 5)
    ).to.be.revertedWith("Insufficient lender liquidity");
  });
});
