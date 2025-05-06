const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  user_address: { type: String, required: true },
  totalCapitalLent: [
    {
      chain_id: { type: Number },
      asset: { type: String },
      amount: { type: Number, default: 0 },
    },
  ],
  totalCapitalBorrowed: [
    {
      chain_id: { type: Number },
      asset: { type: String },
      amount: { type: Number, default: 0 },
    },
  ],
  totalInterestEarned: [
    {
      chain_id: { type: Number },
      asset: { type: String },
      amount: { type: Number, default: 0 },
    },
  ],
  totalReturns: { type: Number, default: 0 },
  loans: [{ type: mongoose.Types.ObjectId, ref: "Loan" }],
  investments: [
    {
      loan_id: { type: mongoose.Types.ObjectId, ref: "Loan" },
      amount: { type: Number },
      interest: { type: Number },
      total: { type: Number },
      received: { type: Number, default: 0 },
      interestReceived: { type: Number, default: 0 },
      totalReceived: { type: Number, default: 0 },
      chain_id: { type: Number },
      asset: { type: String },
    },
  ],
  returns: [
    {
      loan_id: { type: mongoose.Types.ObjectId, ref: "Loan" },
      amount: { type: Number },
      interest: { type: Number },
      total: { type: Number },
    },
  ],
  lendings: [{ type: mongoose.Types.ObjectId, ref: "Lend" }],
  payments: [{ type: mongoose.Types.ObjectId, ref: "Payment" }],
  withdraws: [{ type: mongoose.Types.ObjectId, ref: "Withdraw" }],
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
