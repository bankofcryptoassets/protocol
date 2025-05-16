const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment and test script...");

  // Get accounts
  const [deployer, lender1, lender2, borrower] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Deploy MockDeployer contract
  console.log("Deploying MockDeployer...");
  const MockDeployer = await ethers.getContractFactory("MockDeployer");
  const mockDeployer = await MockDeployer.deploy();
  console.log(`MockDeployer deployed to: ${mockDeployer.address}`);
  
  // Deploy all mock contracts
  console.log("Deploying mock contracts...");
  const deployTx = await mockDeployer.deploy();
  await deployTx.wait();
  console.log("All mock contracts deployed!");
  
  // Initialize contracts with liquidity and settings
  console.log("Initializing mock contracts...");
  const initTx = await mockDeployer.initialize();
  await initTx.wait();
  console.log("Mock contracts initialized with liquidity and settings!");
  
  // Get addresses of all deployed contracts
  const addresses = await mockDeployer.getAddresses();
  console.log("\nDeployed Contract Addresses:");
  console.log("----------------------------");
  console.log(`USDC:          ${addresses.usdcAddress}`);
  console.log(`cbBTC:         ${addresses.cbBtcAddress}`);
  console.log(`AavePool:      ${addresses.aavePoolAddress}`);
  console.log(`SwapRouter:    ${addresses.swapRouterAddress}`);
  console.log(`Price Oracle:  ${addresses.priceOracleAddress}`);
  
  // Mint some test tokens for the deployer
  console.log("\nMinting test tokens for deployer...");
  const usdcAmount = ethers.parseUnits("1000000", 6); // 1 million USDC
  const btcAmount = ethers.parseUnits("10", 8);      // 10 BTC
  
  const mintTx = await mockDeployer.mintTestTokens(deployer.address, usdcAmount, btcAmount);
  await mintTx.wait();
  console.log(`Minted 1,000,000 USDC and 10 cbBTC for ${deployer.address}`);
  
  // Deploy the main LendingPool contract
  console.log("\nDeploying LendingPool contract...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    addresses.usdcAddress,         // USDC token
    addresses.cbBtcAddress,        // cbBTC token
    addresses.priceOracleAddress,  // Price oracle
    addresses.aavePoolAddress,     // Aave pool
    addresses.swapRouterAddress    // Swap router
  );
  
  // Get the actual address of the deployed lending pool
  const lendingPoolAddress = lendingPool.target;
  console.log(`LendingPool deployed to: ${lendingPoolAddress}`);

  console.log("\nDeployment complete! 🎉");
  
  // --- INTERACTION TESTS ---
  console.log("\n-------------- STARTING INTERACTION TESTS --------------");
  
  // Connect to token contracts
  const usdc = await ethers.getContractAt("MockUSDC", addresses.usdcAddress);
  const cbBtc = await ethers.getContractAt("MockCbBTC", addresses.cbBtcAddress);
  
  // 1. Mint tokens for test accounts
  console.log("\nMinting tokens for test accounts...");
  
  // Mint for lenders and borrower
  const lenderAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
  const borrowerUsdcAmount = ethers.parseUnits("50000", 6); // 50,000 USDC
  const borrowerBtcAmount = ethers.parseUnits("1", 8); // 1 BTC
  
  await mockDeployer.mintTestTokens(lender1.address, lenderAmount, 0);
  await mockDeployer.mintTestTokens(lender2.address, lenderAmount, 0);
  await mockDeployer.mintTestTokens(borrower.address, borrowerUsdcAmount, borrowerBtcAmount);
  
  console.log(`Minted 100,000 USDC for each lender`);
  console.log(`Minted 50,000 USDC and 1 BTC for borrower`);
  
  // 2. Check balances
  const lender1Balance = await usdc.balanceOf(lender1.address);
  const lender2Balance = await usdc.balanceOf(lender2.address);
  const borrowerUsdcBalance = await usdc.balanceOf(borrower.address);
  const borrowerBtcBalance = await cbBtc.balanceOf(borrower.address);
  
  console.log("\nCurrent balances:");
  console.log(`Lender1 USDC: ${ethers.formatUnits(lender1Balance, 6)}`);
  console.log(`Lender2 USDC: ${ethers.formatUnits(lender2Balance, 6)}`);
  console.log(`Borrower USDC: ${ethers.formatUnits(borrowerUsdcBalance, 6)}`);
  console.log(`Borrower cbBTC: ${ethers.formatUnits(borrowerBtcBalance, 8)}`);
  
  // 3. Create a loan
  console.log("\nSetting up a test loan...");
  
  // First, approve tokens
  const loanAmount = ethers.parseUnits("50000", 6); // 50,000 USDC loan
  const lender1Amount = ethers.parseUnits("30000", 6); // 30,000 USDC from lender1
  const lender2Amount = ethers.parseUnits("20000", 6); // 20,000 USDC from lender2
  const borrowerDeposit = ethers.parseUnits("10000", 6); // 10,000 USDC deposit (20% of loan)
  
  console.log(`Approving lendingPool at address: ${lendingPoolAddress}`);
  
  // Lenders approve LendingPool to spend their USDC
  const approveTx1 = await usdc.connect(lender1).approve(lendingPoolAddress, lender1Amount);
  await approveTx1.wait();
  console.log(`Lender1 approved LendingPool to spend ${ethers.formatUnits(lender1Amount, 6)} USDC`);

  const approveTx2 = await usdc.connect(lender2).approve(lendingPoolAddress, lender2Amount);
  await approveTx2.wait();
  console.log(`Lender2 approved LendingPool to spend ${ethers.formatUnits(lender2Amount, 6)} USDC`);
  
  // Borrower approves LendingPool to spend their USDC for deposit
  const approveTx3 = await usdc.connect(borrower).approve(lendingPoolAddress, borrowerDeposit);
  await approveTx3.wait();
  console.log(`Borrower approved LendingPool to spend ${ethers.formatUnits(borrowerDeposit, 6)} USDC`);
  
  console.log("Checking allowances to verify approvals:");
  const allowance1 = await usdc.allowance(lender1.address, lendingPoolAddress);
  const allowance2 = await usdc.allowance(lender2.address, lendingPoolAddress);
  const allowance3 = await usdc.allowance(borrower.address, lendingPoolAddress);
  
  console.log(`Lender1 allowance: ${ethers.formatUnits(allowance1, 6)} USDC`);
  console.log(`Lender2 allowance: ${ethers.formatUnits(allowance2, 6)} USDC`);
  console.log(`Borrower allowance: ${ethers.formatUnits(allowance3, 6)} USDC`);
  
  // Create the loan
  console.log("Creating loan...");
  const loanTx = await lendingPool.connect(borrower).loan(
    loanAmount,                      // Total loan amount
    12,                             // 12 months duration
    10,                              // 10% annual interest rate
    [lender1.address, lender2.address],  // Lenders
    [lender1Amount, lender2Amount]       // Lender contributions
  );
  
  const receipt = await loanTx.wait();
  
  // Find the LoanCreated event to get the loan ID
  const loanCreatedEvent = receipt.events.find(event => event.event === "LoanCreated");
  const loanId = loanCreatedEvent.args.id;
  
  console.log(`Loan created with ID: ${loanId}`);
  console.log(`Loan amount: 50,000 USDC`);
  console.log(`Borrower deposit: 10,000 USDC`);
  console.log(`Duration: 12 months`);
  console.log(`Interest rate: 10% annual`);
  
  // 4. Get loan details and amortization schedule
  const loanDetails = await lendingPool.loans(loanId);
  const schedule = await lendingPool.getInstallmentSchedule(loanId);
  
  console.log("\nLoan details:");
  console.log(`Borrower: ${loanDetails.borrower}`);
  console.log(`Principal: ${ethers.formatUnits(loanDetails.principal, 6)} USDC`);
  console.log(`Monthly payment: ${ethers.formatUnits(loanDetails.monthlyPayment, 6)} USDC`);
  console.log(`Start time: ${new Date(Number(loanDetails.startTime) * 1000).toLocaleString()}`);
  console.log(`Is active: ${loanDetails.isActive}`);
  
  console.log("\nAmortization schedule (first 3 months):");
  for (let i = 0; i < Math.min(3, schedule.length); i++) {
    const payment = schedule[i];
    console.log(`Month ${i+1}:`);
    console.log(`  Principal: ${ethers.formatUnits(payment.duePrincipal, 6)} USDC`);
    console.log(`  Interest: ${ethers.formatUnits(payment.dueInterest, 6)} USDC`);
    console.log(`  Due date: ${new Date(Number(payment.dueTimestamp) * 1000).toLocaleString()}`);
    console.log(`  Paid: ${payment.paid}`);
  }
  
  console.log("\nTest interaction complete! 🎉");
  
  // Return all deployed addresses for verification
  return {
    mockDeployer: mockDeployer.address,
    usdc: addresses.usdcAddress,
    cbBtc: addresses.cbBtcAddress,
    aavePool: addresses.aavePoolAddress,
    swapRouter: addresses.swapRouterAddress,
    priceOracle: addresses.priceOracleAddress,
    lendingPool: lendingPoolAddress,
  };
}

// Execute main function
main()
  .then(() => {
    console.log("\nDeployment and testing successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment or testing failed:", error);
    process.exit(1);
  });