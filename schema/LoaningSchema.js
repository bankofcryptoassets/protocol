const mongoose = require("mongoose");

const BorrowingSchema = new mongoose.Schema({
  loan_id: { type: String, required: true },
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },

  loan_amount: { type: Number, required: true },
  up_front_payment: { type: Number, required: true },
  total_amount_payable: { type: Number, required: true },
  remaining_amount: { type: Number, required: true },

  collateral: { type: Number, required: true },
  asset: { type: String, required: true },
  asset_borrowed: { type: Number, required: true },
  asset_remaining: { type: Number, required: true },
  asset_price: { type: Number, required: true },
  asset_released_per_month: { type: Number, required: true },

  chain_id: { type: Number, required: true },
  interest_rate: { type: Number, required: true },
  loan_duration: { type: Number, required: true },
  number_of_monthly_installments: { type: Number, required: true },
  interest: { type: Number, required: true },
  monthly_payable_amount: { type: Number, required: true },
  interest_payable_month: { type: Number, required: true },
  principal_payable_month: { type: Number, required: true },
  liquidation_factor: { type: Number, required: true },

  openedOn: { type: Date, required: true },
  last_payment_date: { type: Date, required: true },
  next_payment_date: { type: Date, required: true },
  months_not_paid: { type: Number, required: true },
  loan_end: { type: Date, required: true },
  reminderDaysBefore: { type: Number, default: 3 },
  
  amortization_schedule: [
    {
      duePrincipal: { type: Number, required: true },
      dueInterest: { type: Number, required: true },
      paid: { type: Boolean, required: true },
    },
  ],

  is_active: { type: Boolean, required: true },
  is_liquidated: { type: Boolean, default: false },
  is_repaid: { type: Boolean, default: false },
  is_defaulted: { type: Boolean, default: false },
  allowances_updated: { type: Boolean, default: false },
  bounce: { type: Boolean, default: false },
  createNotify : { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  loanCreationTxHash: { type: String, default: null },
});

const Loan = mongoose.model("Loan", BorrowingSchema);
module.exports = Loan;
