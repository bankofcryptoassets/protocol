// scripts/deploy-mocks.js
const { ethers } = require("hardhat");
const { interactor } = require("./interaction-test.js");

async function main() {
  console.log("Starting mock deployment script...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
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
  
  console.log(`LendingPool deployed to: ${lendingPool.runner.address}`);

  console.log("\nDeployment complete! 🎉");
  console.log("==============================================");
  console.log("Next steps:");
  console.log("1. Use the MockDeployer to mint tokens for testing");
  console.log("2. Approve the LendingPool to spend your tokens");
  console.log("3. Create test loans on the LendingPool contract");
  console.log("==============================================");


  await interactor(mockDeployer.address, lendingPool.target.address);
  
  // Return all deployed addresses for verification
  return {
    mockDeployer: mockDeployer.address,
    usdc: addresses.usdcAddress,
    cbBtc: addresses.cbBtcAddress,
    aavePool: addresses.aavePoolAddress,
    swapRouter: addresses.swapRouterAddress,
    priceOracle: addresses.priceOracleAddress,
    lendingPool: lendingPool.address
  };
}

main()
  .then(async(deployedAddresses) => {
    console.log("\nDeployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });