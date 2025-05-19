const mongoose = require("mongoose");

const LendingSchema = new mongoose.Schema({
  // Core user identification
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  
  // Lending details from deposit event
  lending_amount_approved: { type: Number, required: true },
  available_amount: { type: Number, required: true },
  utilisedAmount : { type: Number, default: 0 },
    
  // Timestamps
  openedOn: { type: Date, required: true },
  duration_preference: { type: String, required: true },
  
  updated_at: { type: Date, default: Date.now },
  // Related loans (can be populated as loans are created)
  loans: [{ type: mongoose.Types.ObjectId, ref: "Loan" }]
});


const Lend = mongoose.model("Lend", LendingSchema);

module.exports = Lend;
