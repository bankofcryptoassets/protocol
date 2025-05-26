const Lend = require("../schema/LendingSchema");

const { routerContract, usdcContract } = require("./contracts");

const getLiquidity = async (duration, user_id) => {
  let lendings;
  let totalAvailableLiquidity = 0;

  if (duration) {
    // Fetch lendings with a specified duration filter
    lendings = await Lend.find({
      lending_duration: { $gte: duration },
    }).sort({
      timestamp: 1,
    });
  } else {
    // Fetch all lendings
    lendings = await Lend.find().sort({
      timestamp: 1,
    });
  }

  console.log("lendings", lendings);

  // Calculate total available liquidity
  for (const lending of lendings) {
    totalAvailableLiquidity += lending.avaialble_amount;
  }

  return totalAvailableLiquidity;
};

module.exports = { getLiquidity };
