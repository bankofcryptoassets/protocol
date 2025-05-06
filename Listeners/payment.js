const { contract, provider } = require("../constants");

const recordPayment = async () => {
  const blockNumber = await provider.getBlockNumber();
  console.log(blockNumber);

  const paymentEvent = await contract.queryFilter(
    contract.filters.Payment(),
    blockNumber - 100
  );

  console.log(paymentEvent);
  // update to DB -> offchain calculations and liquidity factor calculations
};

module.exports = {
  recordPayment,
};
