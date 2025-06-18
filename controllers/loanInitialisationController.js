const Lend = require("../schema/LendingSchema");
const { contract, usdc } = require("../constants");
const { getUSDRate, getBTCRate } = require("../utils/getPrice");
const { fetchFearGreedIndex } = require("../utils/FGI");
const { uniqueByUserId, totalLoanedInBTC, totalLoanedinUSD, globalUSDInvested, uniqueLenders } = require("../utils/helperStats");
const ethers = require("ethers");

exports.LoanSummary = async (req, res) => {
  try {
    const btcAmount = parseFloat(req.body.amount); // Amount in BTC
    const amountInUSD = await getBTCRate(btcAmount); // USD equivalent
    const term = parseInt(req.body.term);
    const interestRate = parseFloat(req.body.interestRate);
    const btcPrice = amountInUSD / btcAmount;

    const downPaymentAmount = parseFloat(req.body.downPaymentAmount) || (0.2 * amountInUSD); // Amount in USD for down payment

    const totalLoanAmount = parseFloat(amountInUSD);
    const totalLoanAmountRaw = ethers.parseUnits(totalLoanAmount.toString(), 6);
    const downPaymentAmountRaw = ethers.parseUnits(downPaymentAmount.toFixed(6).toString(), 6);

    const [basisPoints, validPayment] = await contract.getDownPaymentBasisPoints(totalLoanAmountRaw, downPaymentAmountRaw);

    console.log("Basis Points:", basisPoints.toString());
    console.log("Valid Payment:", validPayment);

    // ✅ Call the contract for exact borrower deposit and lender principal
    const [borrowerDepositRaw, lenderPrincipalRaw, isValid] = await contract.getLoanRequirements(totalLoanAmountRaw, basisPoints);

    console.log("Borrower Deposit Raw:", borrowerDepositRaw.toString());
    console.log("Lender Principal Raw:", lenderPrincipalRaw.toString());
    console.log("Total Loan Amount Raw:", totalLoanAmountRaw.toString());

    const downPayment = parseFloat(ethers.formatUnits(borrowerDepositRaw, 6));
    const principal = parseFloat(ethers.formatUnits(lenderPrincipalRaw, 6));

    console.log("Down Payment:", downPayment);
    console.log("Principal:", principal);

    const openingFee = principal * 0.01;
    const upfrontPayment = downPayment + openingFee;

    const monthlyInterestRate = interestRate / 100 / 12;
    const monthlyPayment =
      (principal * monthlyInterestRate) /
      (1 - Math.pow(1 + monthlyInterestRate, -term));

    let remainingBalance = principal;
    const amortizationSchedule = [];
    let totalInterest = 0;

    const monthsArray = [0];
    const liquidationPricesArray = [];

    let remainingBtcCollateral = btcAmount;
    const initialLiquidationPrice = principal / btcAmount;
    liquidationPricesArray.push(parseFloat(initialLiquidationPrice.toFixed(2)));

    for (let month = 1; month <= term; month++) {
      const interestPayment = remainingBalance * monthlyInterestRate;
      const principalPayment = monthlyPayment - interestPayment;

      remainingBalance -= principalPayment;
      totalInterest += interestPayment;

      const btcRedeemed = principalPayment / btcPrice;
      remainingBtcCollateral -= btcRedeemed;
      const liquidationPrice = remainingBalance / remainingBtcCollateral;

      monthsArray.push(month);
      liquidationPricesArray.push(parseFloat(liquidationPrice.toFixed(2)));

      amortizationSchedule.push({
        month,
        interestPayment: interestPayment.toFixed(2),
        principalPayment: principalPayment.toFixed(2),
        remainingBalance: remainingBalance < 0 ? "0.00" : remainingBalance.toFixed(2),
        btcRedeemed: btcRedeemed.toFixed(8),
        remainingBtcCollateral: remainingBtcCollateral.toFixed(8),
        liquidationPrice: liquidationPrice.toFixed(2),
      });
    }

    const totalPayment = monthlyPayment * term;
    const apr = calculateAPR(monthlyPayment, term, principal);

    const loanSummary = {
      basisPoints: basisPoints.toString(),
      loanAmount: totalLoanAmount.toFixed(2),
      openingFee: openingFee.toFixed(2),
      upfrontPayment: upfrontPayment.toFixed(6).toString(),
      downPayment : downPayment.toString(),
      principal : principal.toString(),
      monthlyPayment: monthlyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      apr: apr.toFixed(2),
      interestRate,
      term,
      amortizationSchedule,
      firstTransaction: {
        amountSent: upfrontPayment.toFixed(2),
        breakdown: {
          downPayment: downPayment.toFixed(2),
          loanOpeningFee: openingFee.toFixed(2),
        },
      },
      liquidationChart: {
        months: monthsArray,
        liquidationPrices: liquidationPricesArray,
      },
      initialBtcCollateral: btcAmount.toFixed(8),
      currentBtcPrice: btcPrice.toFixed(2),
      contract: {
        totalLoanAmount: totalLoanAmountRaw.toString(),
        borrowerDeposit: borrowerDepositRaw.toString(),
        lenderPrincipal: lenderPrincipalRaw.toString(),
      },
    };

    // console.log(loanSummary);

    res.status(200).json({
      status: "success",
      data: { loanSummary },
    });
  } catch (error) {
    console.error("LoanSummary error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
exports.LoanAvailability = async (req, res) => {
  // Check the amount of USD available in contract -> Use a price feed to convert USD to BTC -> Return the amount of BTC available for loan
  let availableLoanAmountInBTC;
  try {
    const contractBalanceRaw = await usdc.balanceOf(await contract.getAddress());
    const contractBalance = ethers.formatUnits(contractBalanceRaw, 6);
    console.log("Contract Balance:", contractBalance);
    // const parsedContractBalance = parseFloat(ethers.formatUnits(contractBalance, 6));
    const btcAmount = await getUSDRate(Number(contractBalance));

    const availableLoanAmount = Number.parseFloat(btcAmount);
    availableLoanAmountInBTC = availableLoanAmount;
  } catch (error) {
    console.log("Error fetching contract balance:", error);
    availableLoanAmountInBTC = 1;
  }

  if (availableLoanAmountInBTC === 0) {
    availableLoanAmountInBTC = 1;
  }


    const fgi = await fetchFearGreedIndex();
    console.log("Fear & Greed Index:", fgi);

    const btcBorrowers = await uniqueByUserId();
    const totalLoanInBTC = await totalLoanedInBTC();
    const totalLoanInUSD = await totalLoanedinUSD();

  console.log("Total Loaned in BTC:", totalLoanInBTC);
  console.log("Total Loaned in USD:", totalLoanInUSD);
  console.log("Total Borrowers:", btcBorrowers);

  res.status(200).json({
    status: "success",
    data: {
      availableLoanAmountInBTC,
      fgi,
      btcBorrowers,
      totalLoanInBTC,
      totalLoanInUSD,
    },
  });
};

exports.getBTCPrice = async (req, res) => {
  const amount = req.query.amount || 1;
  const btcPrice = await getBTCRate(amount);
  res.status(200).json({
    status: "success",
    data: {
      btcPrice,
    },
  });
};

exports.getUSDRate = async (req, res) => {
  const amount = req.query.amount || 1;
  const usdRate = await getUSDRate(amount);
  res.status(200).json({
    status: "success",
    data: {
      usdRate,
    },
  });
};

function calculateAPR(monthlyPayment, loanTerm, netLoanAmount) {
  let low = 0;
  let high = 1;
  const epsilon = 1e-6;
  let guess;

  while (high - low > epsilon) {
    guess = (low + high) / 2;
    const guessedPayment =
      (netLoanAmount * guess) / (1 - Math.pow(1 + guess, -loanTerm));
    if (guessedPayment > monthlyPayment) {
      high = guess;
    } else {
      low = guess;
    }
  }

  return guess * 12 * 100; // Annualize and convert to percentage
}

exports.getBasisPoints = async(req,res) => {
  try {
    const { totalLoanAmount, downPaymentAmount } = req.query;

    if (!totalLoanAmount || !downPaymentAmount) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const totalLoanAmountRaw = ethers.parseUnits(totalLoanAmount.toString(), 6);
    const downPaymentAmountRaw = ethers.parseUnits(downPaymentAmount.toString(), 6);

    const [basisPoints, validPayment] = await contract.getDownPaymentBasisPoints(totalLoanAmountRaw, downPaymentAmountRaw);

    res.status(200).json({
      status: "success",
      data: {
        basisPoints: basisPoints.toString(),
        validPayment: validPayment,
      },
    });
  } catch (error) {
    console.error("Error fetching basis points:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
}