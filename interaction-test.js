const { ethers } = require("hardhat");

async function interactor(mockDeployerAddress, lendingPoolAddress) {
  console.log("Starting test interactions script...");

  // Get signer accounts
  const [owner, lender1, lender2, borrower] = await ethers.getSigners();
  console.log(`Using owner account: ${owner.address}`);
  console.log(`Using lender1 account: ${lender1.address}`);
  console.log(`Using lender2 account: ${lender2.address}`);
  console.log(`Using borrower account: ${borrower.address}`);
  console.log(`Using mockDeployer address: ${mockDeployerAddress}`);
  console.log(`Using lendingPool address: ${lendingPoolAddress}`);

  // Connect to deployed contracts
  const mockDeployer = await ethers.getContractAt(
    "MockDeployer",
    mockDeployerAddress,
  );

  // Get addresses of all deployed contracts
  const addresses = await mockDeployer.getAddresses();
  const usdcAddress = addresses.usdcAddress;
  const cbBtcAddress = addresses.cbBtcAddress;

  // Connect to token contracts
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  const cbBtc = await ethers.getContractAt("MockCbBTC", cbBtcAddress);

  // Connect to lending pool
  const lendingPool = await ethers.getContractAt(
    "LendingPool",
    lendingPoolAddress,
  );

  // 1. Mint tokens for test accounts
  console.log("\nMinting tokens for test accounts...");

  // Mint for lenders and borrower
  const lenderAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
  const borrowerUsdcAmount = ethers.parseUnits("50000", 6); // 50,000 USDC
  const borrowerBtcAmount = ethers.parseUnits("1", 8); // 1 BTC

  await mockDeployer.mintTestTokens(lender1.address, lenderAmount, 0);
  await mockDeployer.mintTestTokens(lender2.address, lenderAmount, 0);
  await mockDeployer.mintTestTokens(
    borrower.address,
    borrowerUsdcAmount,
    borrowerBtcAmount,
  );

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

  // Lenders approve LendingPool to spend their USDC
  await usdc.connect(lender1).approve(lendingPoolAddress, lender1Amount);
  await usdc.connect(lender2).approve(lendingPoolAddress, lender2Amount);

  // Borrower approves LendingPool to spend their USDC for deposit
  await usdc.connect(borrower).approve(lendingPoolAddress, borrowerDeposit);

  console.log("Approvals set...");

  // Create the loan
  console.log("Creating loan...");
  const loanTx = await lendingPool.connect(borrower).loan(
    loanAmount, // Total loan amount
    12, // 12 months duration
    10, // 10% annual interest rate
    [lender1.address, lender2.address], // Lenders
    [lender1Amount, lender2Amount], // Lender contributions
  );

  const receipt = await loanTx.wait();

  // Find the LoanCreated event to get the loan ID
  const loanCreatedEvent = receipt.events.find(
    (event) => event.event === "LoanCreated",
  );
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
  console.log(
    `Principal: ${ethers.formatUnits(loanDetails.principal, 6)} USDC`,
  );
  console.log(
    `Monthly payment: ${ethers.formatUnits(loanDetails.monthlyPayment, 6)} USDC`,
  );
  console.log(
    `Start time: ${new Date(loanDetails.startTime.toNumber() * 1000).toLocaleString()}`,
  );
  console.log(`Is active: ${loanDetails.isActive}`);

  console.log("\nAmortization schedule (first 3 months):");
  for (let i = 0; i < Math.min(3, schedule.length); i++) {
    const payment = schedule[i];
    console.log(`Month ${i + 1}:`);
    console.log(
      `  Principal: ${ethers.formatUnits(payment.duePrincipal, 6)} USDC`,
    );
    console.log(
      `  Interest: ${ethers.formatUnits(payment.dueInterest, 6)} USDC`,
    );
    console.log(
      `  Due date: ${new Date(payment.dueTimestamp.toNumber() * 1000).toLocaleString()}`,
    );
    console.log(`  Paid: ${payment.paid}`);
  }

  console.log("\nTest interaction complete! 🎉");
}

module.exports = {
  interactor,
};
