const mongoose = require("mongoose");

const InsuranceSchema = new mongoose.Schema(
  {
    loan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    user_address: {
      type: String,
      required: true,
    },
    insured_amount: {
      type: Number,
      required: true,
    },
    strike_price: {
      type: Number,
      required: true,
    },
    expiry_date: {
      type: Date,
      required: true,
    },
    put_option_id: {
      type: String,
      required: true,
    },
    premium_rate: {
      type: Number,
      required: true,
    },
    monthly_premium: {
      type: Number,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "exercised", "cancelled"],
      default: "active",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Insurance", InsuranceSchema); 