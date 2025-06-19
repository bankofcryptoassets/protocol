// scripts/simulate.js
const { ethers } = require("hardhat");
const { parseUnits, formatUnits, keccak256, solidityPacked } = ethers;

async function main() {
  const [deployer, lender, borrower] = await ethers.getSigners();

  console.log("--- Deploying MockDeployer ---");
  const MockDeployer = await ethers.getContractFactory("MockDeployer");
  const mockDeployer = await MockDeployer.deploy();
  await mockDeployer.waitForDeployment();
  await mockDeployer.deploy();
  await mockDeployer.initialize();

  const [usdcAddr, cbBtcAddr, aaveAddr, routerAddr, oracleAddr] = await mockDeployer.getAddresses();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const MockCbBTC = await ethers.getContractFactory("MockCbBTC");
  const usdc = MockUSDC.attach(usdcAddr);
  const cbBtc = MockCbBTC.attach(cbBtcAddr);
  const MockAavePool = await ethers.getContractFactory("MockAavePool");
  const aave = MockAavePool.attach(aaveAddr);

  console.log("--- Minting Tokens to Lender and Borrower ---");
  await mockDeployer.mintTestTokens(lender.address, parseUnits("100000", 6), 0);
  await mockDeployer.mintTestTokens(borrower.address, parseUnits("50000", 6), parseUnits("1", 8));

  const lenderUsdc = await usdc.balanceOf(lender.address);
  const borrowerUsdc = await usdc.balanceOf(borrower.address);
  const borrowerBtc = await cbBtc.balanceOf(borrower.address);
  console.log(`Lender USDC: ${formatUnits(lenderUsdc, 6)} USDC`);
  console.log(`Borrower USDC: ${formatUnits(borrowerUsdc, 6)} USDC`);
  console.log(`Borrower cbBTC: ${formatUnits(borrowerBtc, 8)} cbBTC`);

  console.log("--- Deploying LendingPool ---");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const pool = await LendingPool.deploy(usdcAddr, cbBtcAddr, oracleAddr, aaveAddr, routerAddr);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`LendingPool deployed at: ${poolAddr}`);

  console.log("--- Approvals ---");
  const loanAmount = parseUnits("100000", 6);
  const downPaymentBps = 3000; // 30%
  const borrowerDeposit = (loanAmount * BigInt(downPaymentBps)) / 10000n;
  const borrowerWantsToDeposit = parseUnits("26000", 6); // 26,000 USDC

  const [basisPoints, validPayment] = await pool.getDownPaymentBasisPoints(loanAmount, borrowerWantsToDeposit);
  console.log(`Down payment basis points: ${basisPoints}`);
  console.log(`Borrower wants to deposit: ${formatUnits(borrowerWantsToDeposit, 6)} USDC`);

  const [borrowerHasToDeposit, lenderPrincipal, isvalidPayment] = await pool.getLoanRequirements(loanAmount, basisPoints);
    console.log(`Borrower has to deposit: ${formatUnits(borrowerHasToDeposit, 6)} USDC`);
    console.log(`Lender principal: ${formatUnits(lenderPrincipal, 6)} USDC`);
    console.log(`Is valid payment: ${isvalidPayment}`);

  await usdc.connect(lender).approve(poolAddr, loanAmount);
  await usdc.connect(borrower).approve(poolAddr, borrowerDeposit);

  const lenderAllowance = await usdc.allowance(lender.address, poolAddr);
  const borrowerAllowance = await usdc.allowance(borrower.address, poolAddr);
  console.log(`Lender USDC allowance: ${formatUnits(lenderAllowance, 6)} USDC`);
  console.log(`Borrower USDC allowance: ${formatUnits(borrowerAllowance, 6)} USDC`);

  console.log("--- Lender Deposits to Pool ---");
  await pool.connect(lender).depositToPool(loanAmount, false);
  const lenderPoolBalance = await pool.lenderPoolBalance(lender.address);
  console.log(`Lender pool balance: ${formatUnits(lenderPoolBalance, 6)} USDC`);
  const usdcDeposit = await aave.getUserSupply(usdcAddr, poolAddr);
  console.log(`USDC staked in Aave by pool: ${formatUnits(usdcDeposit, 6)} USDC`);

  console.log("--- Borrower Opens Loan ---");
  const tx = await pool.connect(borrower).loan(
    loanAmount,
    18, // duration in months
    15, // annual interest rate
    downPaymentBps
  );
  await tx.wait();

  const block = await ethers.provider.getBlock("latest");
  const loanId = keccak256(solidityPacked(["address", "uint256"], [borrower.address, block.timestamp]));
  console.log(`Loan ID: ${loanId}`);

  console.log("--- Post-Loan Balances ---");
  const lenderPost = await usdc.balanceOf(lender.address);
  const borrowerPost = await usdc.balanceOf(borrower.address);
  const borrowerCbBtc = await cbBtc.balanceOf(borrower.address);

  console.log(`Lender USDC balance: ${formatUnits(lenderPost, 6)} USDC`);
  console.log(`Borrower USDC balance: ${formatUnits(borrowerPost, 6)} USDC`);
  console.log(`Borrower cbBTC balance: ${formatUnits(borrowerCbBtc, 8)} cbBTC`);


  const stakedCbBtc = await aave.getUserSupply(cbBtcAddr, poolAddr);
  console.log(`Staked cbBTC in Aave by pool: ${formatUnits(stakedCbBtc, 8)} cbBTC`);
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
