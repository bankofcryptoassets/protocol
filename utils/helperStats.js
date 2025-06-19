const Loan = require("../schema/LoaningSchema");
const Lend = require("../schema/LendingSchema");

const uniqueByUserId = async () => {
  try {
    const uniqueLoaners = await Loan.distinct('user_id');
    console.log("Unique user_id count:", uniqueLoaners.length);
    return uniqueLoaners.length;
  } catch (error) {
    console.error("Error fetching unique user_id count:", error);
    throw error;
  }
};

const totalLoanedinUSD = async() => {
    try {
        const totalLoaned = await Loan.aggregate([
        {
            $group: {
            _id: null,
            totalLoaned: { $sum: "$loan_amount" }
            }
        }
        ]);
        console.log("Total loaned in USD:", totalLoaned[0] ? totalLoaned[0].totalLoaned : 0);
        return totalLoaned[0] ? totalLoaned[0].totalLoaned : 0;
    } catch (error) {
        console.error("Error fetching total loaned USD:", error);
        throw error;
    }
}

const totalLoanedInBTC = async() => {
    try {
        const totalLoaned = await Loan.aggregate([
        {
            $group: {
            _id: null,
            totalLoaned: { $sum: "$asset_borrowed" }
            }
        }
        ]);
        console.log("Total loaned in BTC:", totalLoaned[0] ? totalLoaned[0].totalLoaned : 0);
        return totalLoaned[0] ? totalLoaned[0].totalLoaned : 0;
    } catch (error) {
        console.error("Error fetching total loaned BTC:", error);
        throw error;
    }
};

const globalUSDInvested = async () => {
    try {
        const totalInvested = await Lend.aggregate([
            {
                $group: {
                    _id: null,
                    totalInvested: { $sum: "$lending_amount_approved" }
                }
            }
        ]);
        console.log("Total USD invested:", totalInvested[0] ? totalInvested[0].totalInvested : 0);
        return totalInvested[0] ? totalInvested[0].totalInvested : 0;
    } catch (error) {
        console.error("Error fetching total USD invested:", error);
        throw error;
    }
}

const uniqueLenders = async () => {
    try {
        const uniqueLenders = await Lend.distinct('user_id');
        console.log("Unique lenders count:", uniqueLenders.length);
        return uniqueLenders.length;
    } catch (error) {
        console.error("Error fetching unique lenders count:", error);
        throw error;
    }
};

// uniqueByUserId();
// totalLoanedinUSD();
// totalLoanedInBTC();

module.exports = {
    uniqueByUserId,
    totalLoanedinUSD,
    totalLoanedInBTC,
    globalUSDInvested,
    uniqueLenders
};