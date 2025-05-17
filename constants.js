const ethers = require("ethers");
const { abi } =  require("./artifacts/Contracts/Lending.sol/LendingPool.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  'https://sepolia.base.org' // change RPC URL
);
const contractAddress = "0xd8c555F728aCD2441a60e0da3f2591464f364C9c"; // change 
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);

module.exports = {
  provider,
  contractAddress,
  wallet,
  contract,
};
