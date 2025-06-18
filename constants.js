const ethers = require("ethers");
const { abi } = require("./artifacts/contracts/Lending.sol/LendingPool.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://sepolia.base.org", // change RPC URL
);

const contractAddress = "0x5eAe025301215fCda0cb4432FDA51D6580fCc763"; // change
const USDC_Address = "0x377faBD7d29562c059Dd2D3A9C41eF6974d26B21";
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);

module.exports = {
  provider,
  contractAddress,
  wallet,
  contract,
  USDC_Address,
};
