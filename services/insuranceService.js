const DeribitService = require('./deribitService');
const Insurance = require('../schema/InsuranceSchema');
const Loan = require('../schema/LoaningSchema');
const { getBTCRate } = require('../utils/getPrice');

class InsuranceService {
  constructor() {
    this.deribit = new DeribitService(
      process.env.DERIBIT_API_KEY,
      process.env.DERIBIT_API_SECRET
    );
  }

  async calculateInsuranceDetails(loanId) {
    const loan = await Loan.findById(loanId);
    if (!loan) throw new Error('Loan not found');

    const btcPrice = await getBTCRate(1); // Get current BTC price TODO: change this to price of btc during the loan initiation
    const insuredAmount = loan.loan_amount - loan.up_front_payment;
    const btcQuantity = insuredAmount / btcPrice;
    const strikePrice = (insuredAmount / btcQuantity);

    // Calculate expiry date based on current date
    const today = new Date();
    let expiryDate;
    if (today.getDate() <= 20) {
      // Expire at end of current month
      expiryDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      // Expire at end of next month
      expiryDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    }

    // Get option price from Deribit
    const instrumentName = `BTC-${expiryDate.toISOString().slice(0, 10)}-${strikePrice}-P`;
    const optionPrice = await this.deribit.getOptionPrice(instrumentName);

    const monthlyPremium = optionPrice.result.mark_price * btcQuantity;

    return {
      insuredAmount,
      strikePrice,
      expiryDate,
      monthlyPremium,
      instrumentName,
      btcQuantity
    };
  }

  async purchaseInsurance(loanId, userId, userAddress) {
    const insuranceDetails = await this.calculateInsuranceDetails(loanId);
    
    // Purchase PUT option on Deribit
    const putOption = await this.deribit.buyPutOption(
      insuranceDetails.instrumentName,
      insuranceDetails.btcQuantity,
      insuranceDetails.monthlyPremium
    );

    // Create insurance record
    const insurance = await Insurance.create({
      loan_id: loanId,
      user_id: userId,
      user_address: userAddress,
      insured_amount: insuranceDetails.insuredAmount,
      strike_price: insuranceDetails.strikePrice,
      expiry_date: insuranceDetails.expiryDate,
      put_option_id: putOption.result.order.order_id,
      premium_rate: insuranceDetails.monthlyPremium / insuranceDetails.insuredAmount,
      monthly_premium: insuranceDetails.monthlyPremium
    });

    return insurance;
  }

  async rolloverInsurance(insuranceId) {
    const insurance = await Insurance.findById(insuranceId);
    if (!insurance || !insurance.is_active) {
      throw new Error('Insurance not found or inactive');
    }

    // Close existing position
    await this.deribit.sellPutOption(
      insurance.instrument_name,
      insurance.btc_quantity,
      0 // Market order
    );

    // Calculate new expiry
    const today = new Date();
    const expiryDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    // Purchase new PUT option
    const newInstrumentName = `BTC-${expiryDate.toISOString().slice(0, 10)}-${insurance.strike_price}-P`;
    const putOption = await this.deribit.buyPutOption(
      newInstrumentName,
      insurance.btc_quantity,
      insurance.monthly_premium
    );

    // Update insurance record
    insurance.expiry_date = expiryDate;
    insurance.put_option_id = putOption.result.order.order_id;
    insurance.updated_at = new Date();
    await insurance.save();

    return insurance;
  }

  async cancelInsurance(insuranceId) {
    const insurance = await Insurance.findById(insuranceId);
    if (!insurance || !insurance.is_active) {
      throw new Error('Insurance not found or inactive');
    }

    // Close position on Deribit
    await this.deribit.sellPutOption(
      insurance.instrument_name,
      insurance.btc_quantity,
      0 // Market order
    );

    // Update insurance record
    insurance.is_active = false;
    insurance.status = 'cancelled';
    insurance.updated_at = new Date();
    await insurance.save();

    return insurance;
  }

  async getActiveInsurances() {
    return Insurance.find({ is_active: true });
  }

  async getInsuranceByLoanId(loanId) {
    return Insurance.findOne({ loan_id: loanId, is_active: true });
  }
}

module.exports = new InsuranceService(); 