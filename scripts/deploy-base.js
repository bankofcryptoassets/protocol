const { ethers } = require("hardhat");
const { formatUnits } = ethers;

async function main() {
  console.log("Starting deployment script for Base network...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
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

  // Mint test tokens for the deployer - with enough for liquidity operations
  console.log("Minting test tokens for deployer...");
  await mockDeployer.mintTestTokens(
    deployer.address,
    ethers.parseUnits("1000000", 6), // 1M USDC (6 decimals)
    ethers.parseUnits("100", 8), // 100 BTC (8 decimals)
  );
  console.log(`Minted 1,000,000 USDC and 100 cbBTC for ${deployer.address}`);

  // Get instances of ERC20 tokens
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const MockCbBTC = await ethers.getContractFactory("MockCbBTC");
  const usdc = MockUSDC.attach(addresses[0]);
  const cbBtc = MockCbBTC.attach(addresses[1]);

  // Check deployer's balance
  const deployerUsdcBalance = await usdc.balanceOf(deployer.address);
  const deployerBtcBalance = await cbBtc.balanceOf(deployer.address);
  console.log(
    `Deployer USDC balance: ${formatUnits(deployerUsdcBalance, 6)} USDC`,
  );
  console.log(
    `Deployer cbBTC balance: ${formatUnits(deployerBtcBalance, 8)} cbBTC`,
  );

  // Add liquidity to swap router
  console.log("Adding liquidity to swap router...");
  const usdcToAdd = ethers.parseUnits("500000", 6); // 500K USDC
  const btcToAdd = ethers.parseUnits("50", 8); // 50 BTC

  await usdc.connect(deployer).transfer(addresses[3], usdcToAdd);
  await cbBtc.connect(deployer).transfer(addresses[3], btcToAdd);

  console.log(
    `Added ${formatUnits(usdcToAdd, 6)} USDC and ${formatUnits(btcToAdd, 8)} cbBTC to the swap router`,
  );

  // Deploy the LendingPool contract
  console.log("Deploying LendingPool contract...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    addresses[0], // USDC
    addresses[1], // cbBTC
    addresses[4], // Oracle
    addresses[2], // Aave Pool
    addresses[3], // Swap Router
  );
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log(`LendingPool deployed to: ${lendingPoolAddress}`);

  // Print all deployed contract addresses for easy reference
  console.log("\nSummary - All Deployed Contract Addresses:");
  console.log("----------------------------------------");
  console.log(`MockDeployer:  ${await mockDeployer.getAddress()}`);
  console.log(`USDC:          ${addresses[0]}`);
  console.log(`cbBTC:         ${addresses[1]}`);
  console.log(`AavePool:      ${addresses[2]}`);
  console.log(`SwapRouter:    ${addresses[3]}`);
  console.log(`Price Oracle:  ${addresses[4]}`);
  console.log(`LendingPool:   ${lendingPoolAddress}`);

  console.log("\nDeployment on Base network complete! 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
