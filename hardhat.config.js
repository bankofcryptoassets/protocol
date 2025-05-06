/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");


module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Use the IR pipeline
    },
  },
  // networks: {
  //   citrea: {
  //     url: "https://rpc.citrea.network",
  //     chainId: 5115,
  //   },
  // },
};
