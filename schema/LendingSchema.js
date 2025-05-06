const mongoose = require("mongoose");

const LendingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  lending_amount_approved: { type: Number, required: true },
  lending_duration: { type: Number, required: true }, // timestamp
  amount_receivable: { type: Number, required: true },
  interest_rate: { type: Number, required: true },
  interest: { type: Number, required: true },
//   principalReceived: { type: Number, defualt: 0 },
//   interestReceived: { type: Number, defualt: 0 },
//   totalReceived: { type: Number, defualt: 0 },
  ifSlashedReceivable: { type: Number },
//   inUse: { type: Boolean, defualt: false },
  avaialble_amount: { type: Number, required: true },
  loans: [{ type: mongoose.Types.ObjectId, required: true, ref: "Loan" }],
  openedOn: { type: Date, required: true },
  transaction_hash: { type: String },
  chain_id: { type: Number, required: true },
});

const Lend = mongoose.model("Lend", LendingSchema);

module.exports = Lend;
