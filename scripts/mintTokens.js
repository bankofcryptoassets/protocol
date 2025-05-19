const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = ethers;

async function main() {
  // Load signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);

  // Deployed MockDeployer address
  const MOCK_DEPLOYER_ADDRESS = "0x45dF8BF8Ed77Fe7c7549f85edc6ca085beF82D51";

  // Attach to the deployed MockDeployer contract
  const MockDeployer = await ethers.getContractFactory("MockDeployer");
  const mockDeployer = MockDeployer.attach(MOCK_DEPLOYER_ADDRESS);

  // Mint 100 million USDC (6 decimals), 0 BTC (skip)
  const amountUsdc = parseUnits("100000000", 6); // 10M USDC
  const amountBtc = parseUnits("0", 8);         // No cbBTC

  const tx = await mockDeployer.mintTestTokens(deployer.address, amountUsdc, amountBtc);
  await tx.wait();

  // Optionally check USDC balance
  const addresses = await mockDeployer.getAddresses();
  const usdcAddress = addresses[0];

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach(usdcAddress);
  const balance = await usdc.balanceOf(deployer.address);

  console.log(`✅ Minted 100,000,000 USDC to ${deployer.address}`);
  console.log(`💰 New USDC balance: ${formatUnits(balance, 6)} USDC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Minting failed:", error);
    process.exit(1);
  });
