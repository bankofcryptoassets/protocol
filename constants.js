const ethers = require("ethers");
const { abi } = require("./artifacts/Contracts/Lending.sol/LendingPool.json");
const { abi : abiUSDC } = require("./artifacts/Contracts/Helper.sol/MockUSDC.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://rpc.testnet.citrea.xyz", // change RPC URL
);

const contractAddress = "0x841AE47DAAbaB076b7A66457282731d01b09B750"; // change
const USDC_Address = "0xf60Dc951f51F22bC042483024d53D514C6145275";
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
