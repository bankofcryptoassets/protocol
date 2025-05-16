const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = ethers;

async function main() {
  console.log("Starting deployment and test script...");
  
  // Get deployer account
  const [deployer, lender1, lender2, borrower] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Deploy MockDeployer
  console.log("Deploying MockDeployer...");
  const MockDeployer = await ethers.getContractFactory("MockDeployer");
  const mockDeployer = await MockDeployer.deploy();
  await mockDeployer.waitForDeployment();
  console.log(`MockDeployer deployed to: ${await mockDeployer.getAddress()}`);

  // Deploy mock contracts
  console.log("Deploying mock contracts...");
  await mockDeployer.deploy();
  console.log("All mock contracts deployed!");

  // Initialize mock contracts with liquidity and settings
  console.log("Initializing mock contracts...");
  await mockDeployer.initialize();
  console.log("Mock contracts initialized with liquidity and settings!");

  // Get mock contract addresses
  const addresses = await mockDeployer.getAddresses();
  console.log("Deployed Contract Addresses:");
  console.log("----------------------------");
  console.log(`USDC:          ${addresses[0]}`);
  console.log(`cbBTC:         ${addresses[1]}`);
  console.log(`AavePool:      ${addresses[2]}`);
  console.log(`SwapRouter:    ${addresses[3]}`);
  console.log(`Price Oracle:  ${addresses[4]}`);

  // Get instances of ERC20 tokens first (before minting)
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const MockCbBTC = await ethers.getContractFactory("MockCbBTC");
  const usdc = MockUSDC.attach(addresses[0]);
  const cbBtc = MockCbBTC.attach(addresses[1]);

  // Mint test tokens for the deployer - with enough for later liquidity operations
  console.log("Minting test tokens for deployer...");
  await mockDeployer.mintTestTokens(
    deployer.address,
    parseUnits("100000000", 6),  // 100M USDC (6 decimals)
    parseUnits("1000", 8)        // 1000 BTC (8 decimals)
  );
  console.log(`Minted 100,000,000 USDC and 1,000 cbBTC for ${deployer.address}`);
  
  // Check deployer's balance before proceeding
  const deployerUsdcBalance = await usdc.balanceOf(deployer.address);
  const deployerBtcBalance = await cbBtc.balanceOf(deployer.address);
  console.log(`Deployer USDC balance: ${formatUnits(deployerUsdcBalance, 6)} USDC`);
  console.log(`Deployer cbBTC balance: ${formatUnits(deployerBtcBalance, 8)} cbBTC`);

  // Deploy the LendingPool contract
  console.log("Deploying LendingPool contract...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    addresses[0],  // USDC
    addresses[1],  // cbBTC
    addresses[4],  // Oracle
    addresses[2],  // Aave Pool
    addresses[3]   // Swap Router
  );
  await lendingPool.waitForDeployment();
  console.log(`LendingPool deployed to: ${await lendingPool.getAddress()}`);
  console.log("Deployment complete! 🎉");

  // Set up the SwapRouter with higher liquidity
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const swapRouter = MockSwapRouter.attach(addresses[3]);

  console.log("-------------- STARTING INTERACTION TESTS --------------");

  // Check if the swap router has enough liquidity
  const routerUsdcBalance = await usdc.balanceOf(addresses[3]);
  const routerBtcBalance = await cbBtc.balanceOf(addresses[3]);
  console.log(`Swap Router USDC balance: ${formatUnits(routerUsdcBalance, 6)} USDC`);
  console.log(`Swap Router cbBTC balance: ${formatUnits(routerBtcBalance, 8)} cbBTC`);

  // Mint additional test tokens for the test accounts
  console.log("Minting tokens for test accounts...");
  
  // Mint for lenders
  await mockDeployer.mintTestTokens(lender1.address, parseUnits("100000", 6), 0);
  await mockDeployer.mintTestTokens(lender2.address, parseUnits("100000", 6), 0);
  
  // Mint for borrower
  await mockDeployer.mintTestTokens(borrower.address, parseUnits("50000", 6),0);
  
  console.log("Minted 100,000 USDC for each lender");
  console.log("Minted 50,000 USDC and 1 BTC for borrower");

  // Check balances
  const lender1Balance = await usdc.balanceOf(lender1.address);
  const lender2Balance = await usdc.balanceOf(lender2.address);
  const borrowerUsdcBalance = await usdc.balanceOf(borrower.address);
  const borrowerBtcBalance = await cbBtc.balanceOf(borrower.address);

  console.log("Current balances:");
  console.log(`Lender1 USDC: ${formatUnits(lender1Balance, 6)}`);
  console.log(`Lender2 USDC: ${formatUnits(lender2Balance, 6)}`);
  console.log(`Borrower USDC: ${formatUnits(borrowerUsdcBalance, 6)}`);
  console.log(`Borrower cbBTC: ${formatUnits(borrowerBtcBalance, 8)}`);

  // Set up a test loan
  console.log("Setting up a test loan...");
  
  // Calculate the amount of USDC needed for the loan
  const loanAmount = parseUnits("50000", 6);  // 50,000 USDC
  const lender1Amount = parseUnits("20000", 6);  // 20,000 USDC
  const lender2Amount = parseUnits("20000", 6);  // 20,000 USDC
  const borrowerDeposit = (loanAmount * 20n) / 100n;  // 20% deposit = 8,000 USDC
  
  console.log(`Loan amount: ${formatUnits(loanAmount, 6)} USDC`);
  console.log(`Borrower deposit: ${formatUnits(borrowerDeposit, 6)} USDC`);
  
  // Transfer more tokens to the swap router to ensure sufficient liquidity
  console.log("Adding more liquidity to swap router...");
  
  // Check deployer's balance again before the transfer
  const currentDeployerUsdcBalance = await usdc.balanceOf(deployer.address);
  const currentDeployerBtcBalance = await cbBtc.balanceOf(deployer.address);
  console.log(`Deployer current USDC balance: ${formatUnits(currentDeployerUsdcBalance, 6)} USDC`);
  console.log(`Deployer current cbBTC balance: ${formatUnits(currentDeployerBtcBalance, 8)} cbBTC`);
  
  // Add more liquidity to the swap router - using amounts that we're sure the deployer has
  const usdcToAdd = parseUnits("10000000", 6); // 10M USDC
  const btcToAdd = parseUnits("100", 8); // 100 BTC
  
  await usdc.connect(deployer).transfer(addresses[3], usdcToAdd);
  await cbBtc.connect(deployer).transfer(addresses[3], btcToAdd);
  
  console.log(`Added ${formatUnits(usdcToAdd, 6)} USDC and ${formatUnits(btcToAdd, 8)} cbBTC to the swap router`);
  
  // Check new router balances
  const newRouterUsdcBalance = await usdc.balanceOf(addresses[3]);
  const newRouterBtcBalance = await cbBtc.balanceOf(addresses[3]);
  console.log(`New Swap Router USDC balance: ${formatUnits(newRouterUsdcBalance, 6)} USDC`);
  console.log(`New Swap Router cbBTC balance: ${formatUnits(newRouterBtcBalance, 8)} cbBTC`);
  
  // Approve tokens for the lending pool
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log(`Approving lendingPool at address: ${lendingPoolAddress}`);
  
  await usdc.connect(lender1).approve(lendingPoolAddress, lender1Amount);
  await usdc.connect(lender2).approve(lendingPoolAddress, lender2Amount);
  await usdc.connect(borrower).approve(lendingPoolAddress, borrowerDeposit);
  
  console.log(`Lender1 approved LendingPool to spend ${formatUnits(lender1Amount, 6)} USDC`);
  console.log(`Lender2 approved LendingPool to spend ${formatUnits(lender2Amount, 6)} USDC`);
  console.log(`Borrower approved LendingPool to spend ${formatUnits(borrowerDeposit, 6)} USDC`);
  
  // Check allowances to verify approvals
  const lender1Allowance = await usdc.allowance(lender1.address, lendingPoolAddress);
  const lender2Allowance = await usdc.allowance(lender2.address, lendingPoolAddress);
  const borrowerAllowance = await usdc.allowance(borrower.address, lendingPoolAddress);
  
  console.log("Checking allowances to verify approvals:");
  console.log(`Lender1 allowance: ${formatUnits(lender1Allowance, 6)} USDC`);
  console.log(`Lender2 allowance: ${formatUnits(lender2Allowance, 6)} USDC`);
  console.log(`Borrower allowance: ${formatUnits(borrowerAllowance, 6)} USDC`);
  
  // Create the loan
  console.log("Creating loan...");
  const tx = await lendingPool.connect(borrower).loan(
    loanAmount,                             // Total loan amount (40,000 USDC)
    12,                                     // 12 months duration
    10,                                     // 10% annual interest rate
    [lender1.address, lender2.address],     // Lender addresses
    [lender1Amount, lender2Amount]          // Lender amounts
  );
  
  await tx.wait();
  console.log("Loan created successfully!");

  // Get loan details
  const latestBlock = await ethers.provider.getBlock('latest');
  const loanId = ethers.keccak256(
    ethers.solidityPacked(
      ["address", "uint256"],
      [borrower.address, latestBlock.timestamp]
    )
  );
  
  console.log(`Generated loan ID: ${loanId}`);
  
  // Check updated balances
  const updatedLender1Balance = await usdc.balanceOf(lender1.address);
  const updatedLender2Balance = await usdc.balanceOf(lender2.address);
  const updatedBorrowerUsdcBalance = await usdc.balanceOf(borrower.address);
  
  console.log("Updated balances after loan creation:");
  console.log(`Lender1 USDC: ${formatUnits(updatedLender1Balance, 6)}`);
  console.log(`Lender2 USDC: ${formatUnits(updatedLender2Balance, 6)}`);
  console.log(`Borrower USDC: ${formatUnits(updatedBorrowerUsdcBalance, 6)}`);

  const MockAavePool = await ethers.getContractFactory("MockAavePool");
  const aavePool = MockAavePool.attach(addresses[2]);

  const staked = await aavePool.getUserSupply(addresses[1], lendingPoolAddress);
  console.log(`Staked cbBTC in Aave by LendingPool: ${ethers.formatUnits(staked, 8)} cbBTC`); 
  
  console.log("Test completed successfully! 🎉");

  console.log("---------- STARTING REPAYMENT TEST ----------");

  const lpBalanceBefore = await usdc.balanceOf(lendingPoolAddress);
  console.log("LendingPool USDC balance before payout:", formatUnits(lpBalanceBefore, 6));


// Approve repayment
const repaymentAmount = parseUnits("10000", 6); // First repayment
await usdc.connect(borrower).approve(lendingPoolAddress, repaymentAmount);
console.log(`Borrower approved ${formatUnits(repaymentAmount, 6)} USDC for repayment`);

const allowance = await usdc.allowance(borrower.address, lendingPoolAddress);
console.log(`Borrower allowance: ${formatUnits(allowance, 6)} USDC`);

const borrowerBalance = await usdc.balanceOf(borrower.address);
console.log(`Borrower balance: ${formatUnits(borrowerBalance, 6)} USDC`);

const debug = await lendingPool.debugUnstakeCalc(loanId, parseUnits("8333.3333", 6)); // principal repaid in this payout
console.log(`Proportion repaid: ${ethers.formatUnits(debug[0], 18)} (1.0 = fully repaid)`);
console.log(`cbBTC to unstake: ${ethers.formatUnits(debug[1], 8)} cbBTC`);

let stakedBefore = await lendingPool.getStakedAmount(loanId);
console.log(`Staked amount before repayment: ${ethers.formatUnits(stakedBefore, 8)} cbBTC`);

// Call payouts
const payoutTx = await lendingPool.connect(borrower).payouts(loanId, repaymentAmount);
  
await payoutTx.wait();
console.log(`Borrower repaid ${formatUnits(repaymentAmount, 6)} USDC for loan ${loanId}`);

let stakedAfter = await lendingPool.getStakedAmount(loanId);
console.log(`Staked amount after repayment: ${ethers.formatUnits(stakedAfter, 8)} cbBTC`);

// Check balances after payout
const lender1Post = await usdc.balanceOf(lender1.address);
const lender2Post = await usdc.balanceOf(lender2.address);
const borrowerPost = await usdc.balanceOf(borrower.address);
const borrowerBtcPost = await cbBtc.balanceOf(borrower.address);

console.log("Balances after repayment:");
console.log(`Lender1: ${formatUnits(lender1Post, 6)} USDC`);
console.log(`Lender2: ${formatUnits(lender2Post, 6)} USDC`);
console.log(`Borrower: ${formatUnits(borrowerPost, 6)} USDC`);
console.log(`Borrower cbBTC: ${formatUnits(borrowerBtcPost, 8)} cbBTC`);

// Check cbBTC still staked
const remainingStake = await aavePool.getUserSupply(addresses[1], lendingPoolAddress);
console.log(`Remaining cbBTC in Aave for LendingPool: ${formatUnits(remainingStake, 8)} cbBTC`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment or testing failed:", error);
    process.exit(1);
  });