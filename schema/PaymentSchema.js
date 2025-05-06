const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  payment_amount: { type: Number, required: true },
  payment_time: { type: Number, required: true },
  transaction_hash: { type: String },
  loan_id: { type: mongoose.Types.ObjectId, required: true, ref: "Loan" },
  asset: { type: String, required: true },
  lenders: [{ type: mongoose.Types.ObjectId, ref: "Lend" }],
  amount_to_lenders: [
    {
      lend_id: { type: mongoose.Types.ObjectId, ref: "User" },
      amount: { type: Number },
    },
  ],
  interest_to_lenders: {
    lend_id: { type: mongoose.Types.ObjectId, ref: "User" },
    amount: { type: Number },
  },
  total_to_lenders: {
    lend_id: { type: mongoose.Types.ObjectId, ref: "User" },
    amount: { type: Number },
  },
  transaction_hash: { type: String },
});

const Payment = mongoose.model("Payment", PaymentSchema);

module.exports = Payment;
