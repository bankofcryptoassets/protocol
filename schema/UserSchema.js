const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  user_address: { type: String, required: true },
  loans: [{ type: mongoose.Types.ObjectId, ref: "Loan" }],
  payments: [{ type: mongoose.Types.ObjectId, ref: "Payment" }],
  lendings: [{ type: mongoose.Types.ObjectId, ref: "Lend" }],
  withdraws: [{ type: mongoose.Types.ObjectId, ref: "Withdraw" }],
  telegramId : { type: String, default: null },
  totalCapitalLent: {
    chain_id: { type: Number },
    asset: { type: String },
    amount: { type: Number },
  },
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
