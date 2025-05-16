const Lend = require("../schema/LendingSchema");
const { zeistalContract } = require("../utils/contracts");
const { getUSDRate, getBTCRate } = require("../utils/getPrice");
const ethers = require("ethers");

exports.LoanSummary = async (req, res) => {
    const btcAmount = req.body.amount; // Amount in BTC -> Use price oracle to convert to USD
    const amount = await getBTCRate(btcAmount); // Amount in USD
    const term = req.body.term;
    const interestRate = req.body.interestRate;
    const btcPrice = amount / btcAmount; // Current BTC price in USD

    const loanAmount = parseFloat(amount);
    const loanTerm = parseInt(term);
    const interestRateValue = parseFloat(interestRate);
    const monthlyInterestRate = interestRateValue / 100 / 12;

    const downPayment = loanAmount * 0.2;
    const principal = loanAmount - downPayment; // 80% loan (borrowed amount)
    const openingFee = principal * 0.01;
    const upfrontPayment = downPayment + openingFee;

    const monthlyPayment = (principal * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -loanTerm));

    let remainingBalance = principal;
    const amortizationSchedule = [];
    let totalInterest = 0;
    
    // Arrays for liquidation chart
    const monthsArray = [0]; // Start with month 0
    const liquidationPricesArray = [];
    
    // For liquidation calculation
    // Initially, user has the full btcAmount as collateral
    let remainingBtcCollateral = btcAmount;
    
    // Initial liquidation price calculation
    // Example: If loan is $8000 and BTC price is $10000, then liquidation is $8000/$10000 * BTC price = $8000
    const initialLiquidationPrice = principal / btcAmount;
    liquidationPricesArray.push(parseFloat(initialLiquidationPrice.toFixed(2)));
    
    for (let month = 1; month <= loanTerm; month++) {
        const interestPayment = remainingBalance * monthlyInterestRate;
        const principalPayment = monthlyPayment - interestPayment;
        
        // Update remaining balance
        remainingBalance -= principalPayment;
        totalInterest += interestPayment;
        
        // Calculate BTC redeemed with this payment
        // Using your example: if payment is $1000 and BTC price is $10000, then 0.1 BTC is returned
        const btcRedeemed = principalPayment / btcPrice;
        remainingBtcCollateral -= btcRedeemed;
        
        // Calculate liquidation price using your formula
        // Example: If remaining balance is $7000 and remaining BTC is 0.9, then liquidation is $7000/0.9 = $7777...
        const liquidationPrice = remainingBalance / remainingBtcCollateral;
        
        // Add to arrays for chart
        monthsArray.push(month);
        liquidationPricesArray.push(parseFloat(liquidationPrice.toFixed(2)));

        amortizationSchedule.push({
            month,
            interestPayment: interestPayment.toFixed(2),
            principalPayment: principalPayment.toFixed(2),
            remainingBalance: remainingBalance < 0 ? "0.00" : remainingBalance.toFixed(2),
            btcRedeemed: btcRedeemed.toFixed(8),
            remainingBtcCollateral: remainingBtcCollateral.toFixed(8),
            liquidationPrice: liquidationPrice.toFixed(2)
        });
    }

    const totalPayment = monthlyPayment * loanTerm;

    const apr = calculateAPR(monthlyPayment, loanTerm, principal);

    const loanSummary = {
        loanAmount,
        downPayment: downPayment.toFixed(2),
        openingFee: openingFee.toFixed(2),
        upfrontPayment: upfrontPayment.toFixed(2),
        principal: principal.toFixed(2),
        monthlyPayment: monthlyPayment.toFixed(2),
        totalInterest: totalInterest.toFixed(2),
        totalPayment: totalPayment.toFixed(2),
        apr: apr.toFixed(2),
        interestRate: interestRateValue,
        term: loanTerm,
        amortizationSchedule,
        firstTransaction: {
            amountSent: upfrontPayment.toFixed(2),
            breakdown: {
                downPayment: downPayment.toFixed(2),
                loanOpeningFee: openingFee.toFixed(2)
            }
        },
        liquidationChart: {
            months: monthsArray,
            liquidationPrices: liquidationPricesArray
        },
        initialBtcCollateral: btcAmount.toFixed(8),
        currentBtcPrice: btcPrice.toFixed(2)
    };

    console.log(loanSummary);
    res.status(200).json({
        status: 'success',
        data: {
            loanSummary
        }
    });
};


exports.LoanAvailability = async(req,res) => {
    // Check the amount of USD available in contract -> Use a price feed to convert USD to BTC -> Return the amount of BTC available for loan
    let availableLoanAmountInBTC;
    try{
        const allowances = await Lend.find();

        const contractBalance = allowances.reduce((acc, allowance) => {
            return acc + parseFloat(allowance.available_amount);
        }
        , 0);
        console.log("Contract Balance:", contractBalance);
        const parsedContractBalance = parseFloat(ethers.formatUnits(contractBalance, 6));
        const btcAmount = await getUSDRate(parsedContractBalance);
    
        const availableLoanAmount = parseFloat(btcAmount);
        availableLoanAmountInBTC = availableLoanAmount.toFixed(2);
    } catch (error) {
        console.log("Error fetching contract balance:", error);
        availableLoanAmountInBTC = 1;
    }

    if(availableLoanAmountInBTC === 0) {
        availableLoanAmountInBTC = 1;
    }

    res.status(200).json({
        status: 'success',
        data: {
            availableLoanAmountInBTC
        }
    });
}

exports.getBTCPrice = async (req, res) => {
    const amount = req.query.amount || 1;
    const btcPrice = await getBTCRate(amount);
    res.status(200).json({
        status: 'success',
        data: {
            btcPrice
        }
    });
}

exports.getUSDRate = async (req, res) => {
    const amount = req.query.amount || 1;
    const usdRate = await getUSDRate(amount);
    res.status(200).json({
        status: 'success',
        data: {
            usdRate
        }
    });
}


function calculateAPR(monthlyPayment, loanTerm, netLoanAmount) {
    let low = 0;
    let high = 1;
    const epsilon = 1e-6;
    let guess;

    while (high - low > epsilon) {
        guess = (low + high) / 2;
        const guessedPayment = (netLoanAmount * guess) / (1 - Math.pow(1 + guess, -loanTerm));
        if (guessedPayment > monthlyPayment) {
            high = guess;
        } else {
            low = guess;
        }
    }

    return guess * 12 * 100; // Annualize and convert to percentage
}