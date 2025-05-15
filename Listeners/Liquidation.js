
const { contract, provider } = require("../constants");
const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");

const recordLiquidationEvents = async () => {


    // Get the latest block number
    const blockNumber = await provider.getBlockNumber();
    console.log(`Latest block number: ${blockNumber}`);
    
    try {
            // Process liquidation events
            const liquidationEvents = await contract.queryFilter(
              contract.filters.LoanLiquidated(),
              blockNumber - 100
            );
            
            console.log(`Found ${liquidationEvents.length} LoanLiquidated events`);
            
            for (const event of liquidationEvents) {
              await processLiquidationEvent(event);
            } 
    } catch (error) {
        console.error("Error recording liquidation events:", error);
      }
    }


/**
 * Process a LoanLiquidated event
 */
const processLiquidationEvent = async (event) => {
    try {
      const { id, borrower, btcPriceNow } = event.args;
      console.log(`Processing liquidation for loan ${id}, BTC price: ${btcPriceNow}`);
      
      // Get the loan from database
      const loan = await Loan.findOne({ loan_id: id });
      if (!loan) {
        console.error(`Loan with contract ID ${id} not found`);
        return;
      }
      
      // Mark loan as liquidated
      loan.is_active = false;
      loan.is_liquidated = true;
      loan.liquidation_price = btcPriceNow;
      
      await loan.save();
      
      console.log(`Marked loan ${id} as liquidated`);
    } catch (error) {
      console.error(`Error processing liquidation event:`, error);
    }
  };
    

module.exports = {
    recordLiquidationEvents,
};