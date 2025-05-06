const mongoose = require("mongoose");

const WithdrawSchema = new mongoose.Schema({
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  withdraw_amount: { type: Number, required: true },
  withdraw_time: { type: Number, required: true },
  transaction_hash: { type: String, required: true },
  lending_id: { type: mongoose.Types.ObjectId, required: true, ref: "Lend" },
  payment_id: { type: mongoose.Types.ObjectId, required: true, ref: "Payment" },
  asset: { type: String, required: true },
});

const Withdraw = mongoose.model("Withdraw", WithdrawSchema);

module.exports = Withdraw;
