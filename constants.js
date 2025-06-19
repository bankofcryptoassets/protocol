const ethers = require("ethers");
const { abi } = require("./artifacts/Contracts/Lending.sol/LendingPool.json");
const { abi : abiUSDC } = require("./artifacts/Contracts/Helper.sol/MockUSDC.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://sepolia.base.org", // change RPC URL
);

const contractAddress = "0x80822a4BC3Ad8659686e2F44a24c70B47Cd5905b"; // change
const USDC_Address = "0xe270578586FA80B627a0B84a3D86169B4B515730";
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);
const usdc = new ethers.Contract(USDC_Address, abiUSDC, wallet);

module.exports = {
  provider,
  contractAddress,
  wallet,
  contract,
  USDC_Address,
  usdc,
};
