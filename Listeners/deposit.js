const { contract, provider } = require("../constants");

const recordDeposit = async () => {
  const blockNumber = await provider.getBlockNumber();
  console.log(blockNumber);

  const depositEvent = await contract.queryFilter(
    contract.filters.Deposit(),
    blockNumber - 100
  );

  console.log(depositEvent);
  // update to DB
};

module.exports = {
  recordDeposit,
};
