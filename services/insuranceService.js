const DeribitService = require('./deribitService');
const Insurance = require('../schema/InsuranceSchema');
const Loan = require('../schema/LoaningSchema');
const { getBTCRate } = require('../utils/getPrice');
const User = require('../schema/UserSchema');

// Helper function to get the last Friday of a given month
function getLastFridayOfMonth(year, month) {
  // Get the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  // Get the day of the week (0 = Sunday, 5 = Friday)
  const dayOfWeek = lastDay.getDay();
  // Calculate how many days to go back to get to the last Friday
  const daysToSubtract = (dayOfWeek + 2) % 7;
  // Create new date for the last Friday
  return new Date(year, month, lastDay.getDate() - daysToSubtract);
}

class InsuranceService {
  constructor() {
    this.deribit = new DeribitService(
      process.env.DERIBIT_API_KEY,
      process.env.DERIBIT_API_SECRET
    );
  }

  async calculateInsuranceDetails(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) throw new Error('Loan not found');
  
      const btcPrice = loan.asset_price; // the price of the btc when loan is placed
      const insuredAmount = loan.remaining_amount - loan.up_front_payment;
      let btcQuantity = insuredAmount / btcPrice; //TODO remove this
      if (btcQuantity < 0.1) {
        //throw new Error('BTC quantity is too low');
        btcQuantity = 0.1;
      }
      let calculatedStrikePrice = (insuredAmount / btcQuantity);

      // Calculate expiry date based on current date
      const today = new Date();
      let expiryDate;
      if (today.getDate() <= 20) {
        // Expire at last Friday of current month
        expiryDate = getLastFridayOfMonth(today.getFullYear(), today.getMonth());
      } else {
        // Expire at last Friday of next month
        expiryDate = getLastFridayOfMonth(today.getFullYear(), today.getMonth() + 1);
      }

      // Get option price from Deribit
      const monthStr = expiryDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const dayStr = expiryDate.getDate().toString();
      const yearStr = expiryDate.getFullYear().toString().slice(-2);
      const instrumentNameWithoutStrike = `BTC-${dayStr}${monthStr}${yearStr}`;
      // Get all BTC put options
      const instruments = await this.deribit.getInstruments('BTC', 'option');
    

        // Filter for PUT options only and find the closest strike price
        const suitableOptions = instruments.result
        .filter(inst => inst.instrument_name.startsWith(instrumentNameWithoutStrike))
        .filter(inst => inst.instrument_name.endsWith('-P'))

        const putOptionsStrike = suitableOptions.map(inst => ({
          ...inst,
          strikeDiff: Math.abs(inst.strike - calculatedStrikePrice)
        }))
        .sort((a, b) => a.strikeDiff - b.strikeDiff);

      // Get the option with strike price closest to our target
      const closestOption = putOptionsStrike[0];
      if (!closestOption) {
        throw new Error('No suitable PUT options found');
      }
  
      // Ensure we meet minimum trade amount
      const minTradeAmount = closestOption.min_trade_amount || 0.1; // Default to 0.1 if not specified
      let adjustedBtcQuantity = Math.max(btcQuantity, minTradeAmount);
      // Adjust quantity to be a multiple of minTradeAmount and round to 2 decimal places
      adjustedBtcQuantity = Number((Math.ceil(adjustedBtcQuantity / minTradeAmount) * minTradeAmount).toFixed(2));
      return {
        insuredAmount,
        strikePrice:closestOption.strike,
        expiryDate: new Date(closestOption.expiration_timestamp),
        instrumentName: closestOption.instrument_name,
        btcQuantity: adjustedBtcQuantity,
        user_id: loan.user_id,
        user_address: loan.user_address,
      };
    } catch (error) {
      console.log(error);
      throw new Error(error.message);
    }
  }

  async purchaseInsurance(loanId) {
    try {
      const insuranceDetails = await this.calculateInsuranceDetails(loanId);
      // Purchase PUT option on Deribit
      const putOption = await this.deribit.buyPutOption(
        insuranceDetails.instrumentName,
        insuranceDetails.btcQuantity,
      );

      // Create insurance record
      const insurance = await Insurance.create({
        loan_id: loanId,
        user_id: insuranceDetails.user_id,
        user_address: insuranceDetails.user_address,
        insured_amount: insuranceDetails.insuredAmount,
        strike_price: insuranceDetails.strikePrice,
        expiry_date: insuranceDetails.expiryDate,
        btc_quantity: insuranceDetails.btcQuantity,
        put_option_id: putOption.result.order.order_id,
        instrument_name: insuranceDetails.instrumentName,
      });
  
      return insurance;
    } catch (error) {
      console.log('Failed to purchase insurance', error);
      throw new Error('Failed to purchase insurance');
    }
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

    const newLoanDetails = await this.calculateInsuranceDetails(insurance.loan_id);

    // Purchase new PUT option
    const putOption = await this.deribit.buyPutOption(
      newLoanDetails.instrumentName,
      newLoanDetails.btcQuantity,
    );

    // Update insurance record
    insurance.expiry_date = newLoanDetails.expiryDate;
    insurance.btc_quantity = newLoanDetails.btcQuantity;
    insurance.instrument_name = newLoanDetails.instrumentName;
    insurance.strike_price = newLoanDetails.strikePrice;
    insurance.insured_amount = newLoanDetails.insuredAmount;
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

    console.log(insurance);
    // Close position on Deribit
    await this.deribit.sellPutOption(
      insurance.instrument_name,
      insurance.btc_quantity,
    );

    // Update insurance record
    insurance.is_active = false;
    insurance.status = 'cancelled';
    insurance.updated_at = new Date();
    await insurance.save();

    return insurance;
  }

  async getActiveInsurancesForUser(userId) {
    return Insurance.find({ user_id: userId, is_active: true });
  }

  async getInsuranceByLoanId(loanId) {
    return Insurance.findOne({ loan_id: loanId, is_active: true });
  }

  async calculateInsuranceDetailsFromAmount(btcAmount) {
  try {
    const btcPrice = await getBTCRate(); // Your util to get BTC/USD rate

    // Step 1: Adjust BTC quantity
    const btcQuantity = Math.max(btcAmount, 0.1); // Enforce 0.1 minimum
    const insuredAmount = btcQuantity * btcPrice;
    const strikeTarget = insuredAmount / btcQuantity;

    // Step 2: Calculate expiry = Last Friday of month, 1 year from now
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const expiryDate = getLastFridayOfMonth(oneYearLater.getFullYear(), oneYearLater.getMonth());

    const monthStr = expiryDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const dayStr = expiryDate.getDate().toString();
    const yearStr = expiryDate.getFullYear().toString().slice(-2);
    const instrumentPrefix = `BTC-${dayStr}${monthStr}${yearStr}`;

    // Step 3: Get all BTC PUT options
    const instruments = await this.deribit.getInstruments('BTC', 'option');
    const puts = instruments.result
      .filter(inst => inst.instrument_name.startsWith(instrumentPrefix))
      .filter(inst => inst.instrument_name.endsWith('-P'));

    if (!puts.length) throw new Error("No suitable PUT options found");

    // Step 4: Find closest strike
    const closestPut = puts
      .map(inst => ({
        ...inst,
        strikeDiff: Math.abs(inst.strike - strikeTarget)
      }))
      .sort((a, b) => a.strikeDiff - b.strikeDiff)[0];

    if (!closestPut) throw new Error("No PUT option found close to strike");

    // Step 5: Enforce minimum quantity
    const minQty = closestPut.min_trade_amount || 0.1;
    const finalQty = Number((Math.ceil(btcQuantity / minQty) * minQty).toFixed(2));

    // Step 6: Get mark price (estimate per-BTC premium)
    const book = await this.deribit.request('GET', '/public/ticker', {
      instrument_name: closestPut.instrument_name,
    });

    const markPrice = book.result.mark_price;
    const estimatedPremiumBTC = markPrice * finalQty;
    const estimatedPremiumUSD = estimatedPremiumBTC * btcPrice;

    return {
      btcQuantity: finalQty,
      insuredAmount,
      strikePrice: closestPut.strike,
      instrumentName: closestPut.instrument_name,
      expiryDate: new Date(closestPut.expiration_timestamp),
      markPrice,
      estimatedPremiumBTC,
      estimatedPremiumUSD,
    };
  } catch (err) {
    console.error("Error in calculateInsuranceDetailsFromAmount:", err);
    throw new Error(err.message);
  }
}

}

module.exports = new InsuranceService(); 