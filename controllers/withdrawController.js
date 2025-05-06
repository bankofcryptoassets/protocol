const Withdraw = require("../schema/WithdrawSchema");
const Payment = require("../schema/PaymentSchema");
const User = require("../schema/UserSchema");

const createWithdraw = async (req, res) => {
  const { user_address, withdraw_amount, withdraw_time, lending_id, asset } =
    req.body;

  try {
    const user = await User.findById(req.user._id);
    user.withdraws.push(lending_id);
    const paymentDetails = await Payment.find({ lending_id: lending_id });
    let totalWithdrawableAmount = 0;
    const disbursals = [];

    const payments = paymentDetails.map((payment) => {
      disbursals.push(payment._id);
    });
    const withdraw = await Withdraw.create({
      user_id: req.user.user_id,
      user_address,
      withdraw_amount,
      withdraw_time,
      lending_id,
      asset,
      payment_id: [payments],
    });

    for (const payment of paymentDetails) {
      totalWithdrawableAmount += payment.remaining_amount;
      payment.remaining_amount = 0;
      payment.withDraw_id = withdraw._id;
      await payment.save();
    }

    await withdraw.save();
    return res.json({ message: "Withdraw created successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getWithdraws = async (req, res) => {
  try {
    const withdraws = await Withdraw.find({ user_id: req.user.user_id });
    return res.json({ withdraws });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getWithdrawById = async (req, res) => {
  try {
    const { id } = req.params;
    const withdraw = await Withdraw.findById(id);
    return res.json({ withdraw });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getTotalWithDrawableByLending = async (lending_id) => {
  const paymentDetails = await Payment.find({ lending_id: lending_id });
  let totalWithdrawableAmount = 0;

  for (const payment of paymentDetails) {
    totalWithdrawableAmount += payment.remaining_amount;
  }

  return totalWithdrawableAmount;
};

const getTotalWithDrawable = async (user_id) => {
  const withdrawable = await Payment.find({ user_id: user_id });
  let totalWithdrawableAmount = 0;

  for (const payment of withdrawable) {
    totalWithdrawableAmount += payment.remaining_amount;
  }

  return totalWithdrawableAmount;
};

module.exports = {
  createWithdraw,
  getWithdraws,
  getWithdrawById,
  getTotalWithDrawableByLending,
  getTotalWithDrawable,
};
