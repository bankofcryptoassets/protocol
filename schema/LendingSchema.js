const mongoose = require("mongoose");

const LendingSchema = new mongoose.Schema({
  // Core user identification
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  
  // Lending details from deposit event
  lending_amount_approved: { type: String, required: true },
  available_amount: { type: String, required: true },
  
  // Blockchain information
  transaction_hash: { type: String, required: true },
  chain_id: { type: Number, required: true },
  
  // Timestamps
  openedOn: { type: Date, required: true },
  
  // Related loans (can be populated as loans are created)
  loans: [{ type: mongoose.Types.ObjectId, ref: "Loan" }]
});


const Lend = mongoose.model("Lend", LendingSchema);

module.exports = Lend;
