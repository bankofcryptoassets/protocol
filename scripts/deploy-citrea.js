const { ethers } = require("hardhat");
const { formatUnits } = ethers;

async function main() {
  console.log("Starting deployment script for Citrea network...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Deploy MockDeployer
  console.log("Deploying MockDeployer...");
  const MockDeployer = await ethers.getContractFactory("MockDeployer");
  const mockDeployer = await MockDeployer.deploy();
  await mockDeployer.waitForDeployment();
  console.log(`MockDeployer deployed to: ${await mockDeployer.getAddress()}`);

  // Deploy mock contracts (WAIT)
  console.log("Deploying mock contracts...");
  const mockDeployerDeployTX = await mockDeployer.deploy();
  await mockDeployerDeployTX.wait();
  // If you still want a short pause, you must await it:
  await new Promise((resolve) => setTimeout(resolve, 10000));
  console.log("All mock contracts deployed!");

  // (Optional) sanity check before initialize
  const addrsPreInit = await mockDeployer.getAddresses();
  if (addrsPreInit.some((a) => a === ethers.ZeroAddress)) {
    throw new Error("One or more mock addresses are zero after deploy().");
  }

  // Initialize (WAIT)
  console.log("Initializing mock contracts...");
  const initTx = await mockDeployer.initialize();
  await initTx.wait();
  console.log("Mock contracts initialized with liquidity and settings!");

  // Get mock contract addresses
  const addresses = await mockDeployer.getAddresses();
  console.log("Deployed Contract Addresses:");
  console.log("----------------------------");
  console.log(`USDC:          ${addresses[0]}`);
  console.log(`WCBTC:         ${addresses[1]}`);
  console.log(`AavePool:      ${addresses[2]}`);
  console.log(`SwapRouter:    ${addresses[3]}`);
  console.log(`Price Oracle:  ${addresses[4]}`);

  // Mint test tokens (WAIT)
  console.log("Minting test tokens for deployer...");
  const mintTx = await mockDeployer.mintTestTokens(
    deployer.address,
    ethers.parseUnits("1000000", 6),
    ethers.parseUnits("100", 8),
  );
  await mintTx.wait();
  console.log(`Minted 1,000,000 USDC and 100 WCBTC for ${deployer.address}`);

  // Instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const MockWCBTC = await ethers.getContractFactory("MockWCBTC");
  const usdc = MockUSDC.attach(addresses[0]);
  const wcbtc = MockWCBTC.attach(addresses[1]);

  // Balances
  const [deployerUsdcBalance, deployerBtcBalance] = await Promise.all([
    usdc.balanceOf(deployer.address),
    wcbtc.balanceOf(deployer.address),
  ]);
  console.log(`Deployer USDC balance: ${formatUnits(deployerUsdcBalance, 6)} USDC`);
  console.log(`Deployer WCBTC balance: ${formatUnits(deployerBtcBalance, 8)} WCBTC`);

  // Add liquidity (WAIT)
  console.log("Adding liquidity to swap router...");
  const usdcToAdd = ethers.parseUnits("500000", 6);
  const btcToAdd = ethers.parseUnits("50", 8);

  const usdcDepositTx =  await usdc.connect(deployer).transfer(addresses[3], usdcToAdd);
  await usdcDepositTx.wait();

  const btcDepositTx = await wcbtc.connect(deployer).transfer(addresses[3], btcToAdd);
  await btcDepositTx.wait();

  console.log(
    `Added ${formatUnits(usdcToAdd, 6)} USDC and ${formatUnits(btcToAdd, 8)} WCBTC to the swap router`,
  );

  // LendingPool (WAIT)
  console.log("Deploying LendingPool contract...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    addresses[0], // USDC
    addresses[1], // WCBTC
    addresses[4], // Oracle
    addresses[2], // Aave Pool
    addresses[3], // Swap Router
  );
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log(`LendingPool deployed to: ${lendingPoolAddress}`);

  console.log("\nSummary - All Deployed Contract Addresses:");
  console.log("----------------------------------------");
  console.log(`MockDeployer:  ${await mockDeployer.getAddress()}`);
  console.log(`USDC:          ${addresses[0]}`);
  console.log(`WCBTC:         ${addresses[1]}`);
  console.log(`AavePool:      ${addresses[2]}`);
  console.log(`SwapRouter:    ${addresses[3]}`);
  console.log(`Price Oracle:  ${addresses[4]}`);
  console.log(`LendingPool:   ${lendingPoolAddress}`);

  console.log("\nDeployment on Citrea network complete! 🎉");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
