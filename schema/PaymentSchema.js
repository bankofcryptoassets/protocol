const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  payment_amount: { type: Number, required: true },
  payment_time: { type: Number, required: true },
  transaction_hash: { type: String },
  loan_id: { type: mongoose.Types.ObjectId, required: true, ref: "Loan" },
  asset: { type: String, required: true },
  distributions: [
    {
      user_address: { type: String },
      amount: { type: Number },
      interest: { type: Number },
      total: { type: Number },
    },
  ],
});


PaymentSchema.methods.calculateTotalDistribution = function() {
  return this.distributions.reduce((total, distribution) => total + distribution.total, 0);
};

PaymentSchema.methods.addDistribution = function(userAddress, amount, interest) {
  const total = amount + interest;
  this.distributions.push({ user_address: userAddress, amount, interest, total });
};

const Payment = mongoose.model("Payment", PaymentSchema);

module.exports = Payment;
