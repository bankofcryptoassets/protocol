const ethers = require("ethers");

const erc20Abi = require("../public/ERC20Abi.json");
const routerAbi = require("../public/RouterAbi.json");
const zeistalAbi = require("../public/ZeistalAbi.json");

const rpc = new ethers.JsonRpcProvider("https://sepolia.base.org"); // Replace with actual RPC URL
const routerContractAddress = "0xb1c026CFce4478DaF34FD72cB8ac959e35823F21";
const usdcContractAddress = "0x377faBD7d29562c059Dd2D3A9C41eF6974d26B21";
const zeistalContractAddress = "0xd8c555F728aCD2441a60e0da3f2591464f364C9c";

const routerContract = new ethers.Contract(
  routerContractAddress,
  routerAbi.abi,
  rpc,
);
const usdcContract = new ethers.Contract(
  usdcContractAddress,
  erc20Abi.abi,
  rpc,
);
const zeistalContract = new ethers.Contract(
  zeistalContractAddress,
  zeistalAbi.abi,
  rpc,
);

module.exports = { routerContract, usdcContract, zeistalContract };
