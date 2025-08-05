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
    const btcPrice = await getBTCRate(btcAmount); // Current BTC/USD rate

    // Step 1: Adjust BTC quantity to minimum 0.1
    const btcQuantity = Math.max(btcAmount, 0.1);
    const insuredAmount = btcQuantity * btcPrice;

    // Step 2: Get all available BTC options from Deribit first
    const instruments = await this.deribit.getInstruments('BTC', 'option');
    
    // Filter for active PUT options only
    const allPutOptions = instruments.result
      .filter(inst => inst.instrument_name.endsWith('-P'))
      .filter(inst => inst.is_active)
      .map(inst => ({
        ...inst,
        expiryDate: new Date(inst.expiration_timestamp)
      }))
      .sort((a, b) => b.expiration_timestamp - a.expiration_timestamp); // Sort by expiry, latest first

    if (!allPutOptions.length) {
      throw new Error("No active PUT options found on Deribit");
    }

    // Step 3: Find the furthest expiry date available (closest to 1 year if possible)
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    // Get the furthest available expiry (Deribit usually has 3-6 months max)
    const furthestExpiry = allPutOptions[0].expiryDate;
    
    console.log("Available expiry dates:");
    const uniqueExpiries = [...new Set(allPutOptions.map(opt => opt.expiryDate.toDateString()))];
    uniqueExpiries.forEach(expiry => console.log(" -", expiry));
    console.log("Selected furthest expiry:", furthestExpiry.toDateString());

    // Step 4: Filter PUT options for the selected expiry date
    const putOptions = allPutOptions.filter(opt => 
      opt.expiration_timestamp === allPutOptions[0].expiration_timestamp
    );

    console.log(`Found ${putOptions.length} PUT options for expiry ${furthestExpiry.toDateString()}`);

    // Step 5: Find PUT option with strike price closest to current BTC price
    // This provides protection if BTC drops below current price
    const targetStrike = btcPrice; // Protect at current BTC price
    
    const closestPutOption = putOptions
      .map(inst => ({
        ...inst,
        strikeDiff: Math.abs(inst.strike - targetStrike)
      }))
      .sort((a, b) => a.strikeDiff - b.strikeDiff)[0];

    if (!closestPutOption) {
      throw new Error("No suitable PUT option found");
    }

    // Step 6: Adjust quantity to meet minimum trade requirements
    const minTradeAmount = closestPutOption.min_trade_amount || 0.1;
    const adjustedQuantity = Math.max(btcQuantity, minTradeAmount);
    const finalQuantity = Number(
      (Math.ceil(adjustedQuantity / minTradeAmount) * minTradeAmount).toFixed(2)
    );

    // Step 7: Get current market pricing for the option
    const ticker = await this.deribit.request('GET', '/public/ticker', {
      instrument_name: closestPutOption.instrument_name,
    });

    const markPrice = ticker.result.mark_price; // Price per BTC of the option
    const bidPrice = ticker.result.best_bid_price;
    const askPrice = ticker.result.best_ask_price;
    
    // Calculate total premium costs
    const estimatedPremiumBTC = markPrice * finalQuantity;
    const estimatedPremiumUSD = estimatedPremiumBTC * btcPrice;
    
    // Calculate bid/ask spread for better pricing info
    const bidPremiumBTC = bidPrice * finalQuantity;
    const askPremiumBTC = askPrice * finalQuantity;
    const bidPremiumUSD = bidPremiumBTC * btcPrice;
    const askPremiumUSD = askPremiumBTC * btcPrice;

    return {
      btcQuantity: finalQuantity,
      originalAmount: btcAmount,
      insuredAmount,
      currentBtcPrice: btcPrice,
      strikePrice: closestPutOption.strike,
      instrumentName: closestPutOption.instrument_name,
      expiryDate: new Date(closestPutOption.expiration_timestamp),
      
      // Pricing information
      markPrice,
      bidPrice,
      askPrice,
      
      // Premium costs (what you'll pay for the insurance)
      estimatedPremiumBTC,
      estimatedPremiumUSD,
      bidPremiumBTC,
      bidPremiumUSD,
      askPremiumBTC,
      askPremiumUSD,
      
      // Additional info
      minTradeAmount,
      instrumentDetails: {
        strike: closestPutOption.strike,
        expiration: new Date(closestPutOption.expiration_timestamp),
        isActive: closestPutOption.is_active,
        tickSize: closestPutOption.tick_size,
        contractSize: closestPutOption.contract_size
      }
    };

  } catch (error) {
    console.error("Error in calculateInsuranceDetailsFromAmount:", error);
    throw new Error(`Failed to calculate insurance details: ${error.message}`);
  }
}
}

module.exports = new InsuranceService(); 