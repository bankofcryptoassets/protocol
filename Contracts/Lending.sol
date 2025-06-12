// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

// AAVE Interfaces
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface ISwapRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract LendingPool {
    using SafeERC20 for IERC20;

    // AAVE and Swap contracts
    IAavePool public aavePool;
    ISwapRouter public swapRouter;
    address public cbBtcToken;
    
    AggregatorV3Interface public chainlinkOracle;

    struct Lender {
        uint256 totalContributed;  // Track total contributions for reporting
    }

    struct LenderContribution {
        address lender;
        uint256 amount;
        uint256 receivableInterest;
        uint256 repaidPrincipal;
        uint256 repaidInterest;
    }

    struct Installment {
        uint256 duePrincipal;
        uint256 dueInterest;
        bool paid;
        uint256 dueTimestamp; 
    }

    struct Loan {
        bytes32 id;
        address borrower;
        uint256 principal;
        uint256 borrowerDeposit;
        uint256 interestRate;
        uint256 duration;
        uint256 monthlyPayment;
        uint256 startTime;
        uint256 btcPriceAtCreation;
        bool isActive;
        uint256 totalAmount;      // Total amount of the loan
        LenderContribution[] contributions;
        Installment[] amortizationSchedule;
        uint256 stakedAmount;     // Amount of cbBTC staked in AAVE
        uint256 remainingPrincipal; // Tracking remaining principal after repayments
    }

    mapping(address => Lender) public lenders;
    mapping(bytes32 => Loan) public loans;
    mapping(address => bool) public hasActiveLoan;
    bytes32[] public loanIds;

    address public owner;
    address public usdcToken;

    // Pooling variables
    mapping(address => uint256) public lenderPoolBalance;
    uint256 public totalPoolBalance;

    // Fee parameters (in basis points, 1% = 100)
    uint256 public originationFeeBps;
    uint256 public earlyClosureFeeBps;
    uint256 public missedPaymentFeeBps;
    uint256 public accumulatedFees;

    // Events
    event LoanCreated(bytes32 id, uint256 amount, uint256 collateral, address borrower);
    event LoanLiquidated(bytes32 id, address borrower, uint256 btcPriceNow);
    event Payout(bytes32 loanId, address borrower, uint256 amount, bool fullyRepaid);
    event InstallmentPaid(bytes32 loanId, uint256 index);
    event TokensStaked(bytes32 loanId, uint256 usdcAmount, uint256 cbBtcAmount);
    event TokensUnstaked(bytes32 loanId, uint256 cbBtcAmount, uint256 usdcAmount, uint256 borrowerCbBtcShare);

event DebugUnstakeProportion(
    bytes32 loanId,
    uint256 principalRepaid,
    uint256 proportionRepaid,
    uint256 cbBtcToUnstake
);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(
        address usdc, 
        address _cbBtcToken,
        address oracleAddress, 
        address _aavePool, 
        address _swapRouter
    ) {
        owner = msg.sender;
        usdcToken = usdc;
        cbBtcToken = _cbBtcToken;
        chainlinkOracle = AggregatorV3Interface(oracleAddress);
        aavePool = IAavePool(_aavePool);
        swapRouter = ISwapRouter(_swapRouter);
  
        originationFeeBps = 0;
        earlyClosureFeeBps = 0;
        missedPaymentFeeBps = 0;
    }

    function getPrice() public view returns (int256) {
        (, int256 answer,,,) = chainlinkOracle.latestRoundData();
        return answer;
    }

    function loan(
        uint256 totalAmount, 
        uint256 durationMonths, 
        uint256 annualInterestRate
    ) external {
        require(totalAmount > 0, "Invalid amount");
        require(durationMonths > 0, "Invalid duration");
        require(!hasActiveLoan[msg.sender], "Borrower already has an active loan");
        require(totalPoolBalance >= totalAmount, "Insufficient pool liquidity");
        
        // Origination fee
        uint256 originationFee = (totalAmount * originationFeeBps) / 10000;
        if (originationFee > 0) {
            IERC20(usdcToken).transferFrom(msg.sender, address(this), originationFee);
            accumulatedFees += originationFee;
        }

        // Withdraw from AAVE pool for the loan
        uint256 withdrawn = aavePool.withdraw(usdcToken, totalAmount, address(this));
        require(withdrawn == totalAmount, "Withdraw mismatch");
        totalPoolBalance -= totalAmount;

        // Create loan and collect deposit
        bytes32 loanId = _createLoan(totalAmount, durationMonths, annualInterestRate);
        Loan storage newLoan = loans[loanId];
        
        // Swap USDC to cbBTC
        uint256 cbBtcAmount = _swapUsdcToCbBtc(newLoan.totalAmount);
        // Stake cbBTC to AAVE
        _stakeCbBtcToAave(loanId, cbBtcAmount);
        emit LoanCreated(loanId, totalAmount, newLoan.borrowerDeposit, msg.sender);
    }
    
function _swapUsdcToCbBtc(uint256 usdcAmount) internal returns (uint256) {
    IERC20(usdcToken).approve(address(swapRouter), usdcAmount);

    address[] memory path = new address[](2);
    path[0] = usdcToken;
    path[1] = cbBtcToken;

    // Fetch latest BTC price from Chainlink-like oracle (e.g., 103000 * 10^8)
    (, int256 price,,,) = chainlinkOracle.latestRoundData();
    require(price > 0, "Invalid price");

    // Compute how much cbBTC we expect: cbBTC = USDC * 10^8 / (BTC price in 10^8)
    uint256 expectedCbBtc = (usdcAmount * 1e8) / uint256(price);

    // Apply 2% slippage buffer
    uint256 amountOutMin = (expectedCbBtc * 98) / 100;

    uint256[] memory amounts = swapRouter.swapExactTokensForTokens(
        usdcAmount,
        amountOutMin,
        path,
        address(this),
        block.timestamp + 300
    );

    return amounts[1];
}
  
    
    function _stakeCbBtcToAave(bytes32 loanId, uint256 cbBtcAmount) internal {
        Loan storage loan = loans[loanId];
        
        // Approve AAVE to spend our cbBTC
        IERC20(cbBtcToken).approve(address(aavePool), cbBtcAmount);
        
        // Supply cbBTC to AAVE
        aavePool.supply(cbBtcToken, cbBtcAmount, address(this), 0);
        
        // Update loan staked amount
        loan.stakedAmount = cbBtcAmount;
        
        emit TokensStaked(loanId, loan.principal, cbBtcAmount);
    }
    
    function _createLoan(
        uint256 totalAmount, 
        uint256 durationMonths, 
        uint256 annualInterestRate
    ) internal returns (bytes32) {
        uint256 borrowerDeposit = (totalAmount * 20) / 100;
        uint256 lenderPrincipal = totalAmount - borrowerDeposit;
        // Transfer the borrower's deposit
        IERC20(usdcToken).transferFrom(msg.sender, address(this), borrowerDeposit);
        // Create loan ID
        bytes32 loanId = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        Loan storage newLoan = loans[loanId];
        newLoan.id = loanId;
        newLoan.borrower = msg.sender;
        newLoan.totalAmount = totalAmount;
        newLoan.principal = lenderPrincipal;
        newLoan.borrowerDeposit = borrowerDeposit;
        newLoan.interestRate = annualInterestRate;
        newLoan.duration = durationMonths;
        newLoan.startTime = block.timestamp;
        newLoan.btcPriceAtCreation = uint256(getPrice());
        newLoan.isActive = true;
        newLoan.remainingPrincipal = lenderPrincipal;
        // Calculate monthly payment
        uint256 monthlyRate = (annualInterestRate * 1e18) / (12 * 100);
        newLoan.monthlyPayment = (lenderPrincipal * monthlyRate) / (1e18 - (1e18 / (1e18 + monthlyRate)) ** durationMonths);
        // Create amortization schedule
        _createAmortizationSchedule(loanId, lenderPrincipal, monthlyRate, durationMonths);
        loanIds.push(loanId);
        hasActiveLoan[msg.sender] = true;
        return loanId;
    }
    
    function _createAmortizationSchedule(
    bytes32 loanId,
    uint256 principal,
    uint256 monthlyRate, // e.g. 0.008333 * 1e18
    uint256 months
) internal {
    Loan storage loan = loans[loanId];

    uint256 remainingPrincipal = principal;

    // Calculate monthly payment using amortized formula
    uint256 ratePow = _pow((1e18 + monthlyRate), months); // (1 + r)^n
    uint256 payment = (principal * monthlyRate * ratePow) / (ratePow - 1e18) / 1e18;

    loan.monthlyPayment = payment;

    for (uint256 m = 0; m < months; m++) {
        uint256 interest = (remainingPrincipal * monthlyRate) / 1e18;
        uint256 principalPortion = payment > interest ? payment - interest : 0;

        // Final adjustment to ensure exact payoff
        if (m == months - 1) {
            principalPortion = remainingPrincipal;
            payment = principalPortion + interest;
        }

        loan.amortizationSchedule.push(Installment({
            duePrincipal: principalPortion,
            dueInterest: interest,
            paid: false,
            dueTimestamp: block.timestamp + (m * 30 days)
        }));

        remainingPrincipal -= principalPortion;
    }
}

    function getInstallmentSchedule(bytes32 loanId) external view returns (Installment[] memory) {
        return loans[loanId].amortizationSchedule;
    }

    function markInstallmentPaid(bytes32 loanId, uint256 index) external onlyOwner {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Loan is not active");
        require(index < loan.amortizationSchedule.length, "Invalid installment index");
        require(!loan.amortizationSchedule[index].paid, "Installment already marked paid");

        loan.amortizationSchedule[index].paid = true;
        emit InstallmentPaid(loanId, index);
    }

function payouts(bytes32 loanId, uint256 usdcAmount) external {
    Loan storage loan = loans[loanId];
    require(loan.isActive, "Loan is not active");
    require(msg.sender == loan.borrower, "Only borrower can repay");
    IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount);
    uint256 remainingPayment = usdcAmount;
    uint256 totalPrincipalRepaid = 0;
    for (uint256 i = 0; i < loan.amortizationSchedule.length && remainingPayment > 0; i++) {
        Installment storage installment = loan.amortizationSchedule[i];
        require(installment.duePrincipal > 0, "Installment already paid");
        if (installment.paid) continue;
        uint256 installmentTotal = installment.duePrincipal + installment.dueInterest;
        if (remainingPayment >= installmentTotal) {
            remainingPayment -= installmentTotal;
            totalPrincipalRepaid += installment.duePrincipal;
            installment.paid = true;
            emit InstallmentPaid(loanId, i);
        }
    }
    // Restake repayment into AAVE pool
    uint256 restakeAmount = usdcAmount - remainingPayment;
    if (restakeAmount > 0) {
        IERC20(usdcToken).approve(address(aavePool), restakeAmount);
        aavePool.supply(usdcToken, restakeAmount, address(this), 0);
        totalPoolBalance += restakeAmount;
    }
    _unstakeProportionalAmount(loanId, totalPrincipalRepaid);
    emit Payout(loanId, msg.sender, usdcAmount - remainingPayment, remainingPayment == 0);
    // Early closure fee logic remains unchanged
    bool allPaid = true;
    uint256 lastDueTimestamp = 0;
    for (uint256 i = 0; i < loan.amortizationSchedule.length; i++) {
        if (!loan.amortizationSchedule[i].paid) {
            allPaid = false;
            break;
        }
        if (loan.amortizationSchedule[i].dueTimestamp > lastDueTimestamp) {
            lastDueTimestamp = loan.amortizationSchedule[i].dueTimestamp;
        }
    }
    if (allPaid && block.timestamp < lastDueTimestamp) {
        uint256 earlyFee = (loan.principal * earlyClosureFeeBps) / 10000;
        if (earlyFee > 0) {
            IERC20(usdcToken).transferFrom(msg.sender, address(this), earlyFee);
            accumulatedFees += earlyFee;
        }
    }
}


function _unstakeFromAave(bytes32 loanId, uint256 cbBtcAmount, bool returnToBorrower) internal {
    Loan storage loan = loans[loanId];
    require(cbBtcAmount <= loan.stakedAmount, "Cannot unstake more than staked amount");
    require(cbBtcAmount > 0, "Cannot unstake zero amount");

    // Debug balance check before withdrawal
    uint256 preBalance = IERC20(cbBtcToken).balanceOf(address(this));
    
    // Withdraw from Aave pool
    uint256 actualWithdrawn = aavePool.withdraw(cbBtcToken, cbBtcAmount, address(this));
    
    // Debug balance check after withdrawal
    uint256 postBalance = IERC20(cbBtcToken).balanceOf(address(this));
    
    // Verify withdrawal actually increased our balance
    require(postBalance > preBalance, "Withdrawal didn't increase balance");
    require(actualWithdrawn > 0, "Unstake returned zero tokens");

    // Update internal state - use actualWithdrawn instead of cbBtcAmount
    loan.stakedAmount -= actualWithdrawn;

    // If borrower is to receive the tokens back
    if (returnToBorrower) {
        bool success = IERC20(cbBtcToken).transfer(loan.borrower, actualWithdrawn);
        require(success, "Transfer to borrower failed");

        emit TokensUnstaked(loanId, cbBtcAmount, 0, actualWithdrawn);
    } else {
        // Optional fallback
        uint256 usdcReceived = _swapCbBtcToUsdc(actualWithdrawn);
        emit TokensUnstaked(loanId, cbBtcAmount, usdcReceived, 0);
    }
    
    // Emit debug event
    emit DebugUnstake(loanId, cbBtcAmount, actualWithdrawn, preBalance, postBalance);
}
// 2. Add a debug event to track withdrawal success
event DebugUnstake(bytes32 loanId, uint256 requested, uint256 actualWithdrawn, uint256 preBalance, uint256 postBalance);

// 3. Modify the _unstakeProportionalAmount function to add debugging

function _unstakeProportionalAmount(bytes32 loanId, uint256 usdcAmount) internal {
    Loan storage loan = loans[loanId];
    if (usdcAmount == 0 || loan.btcPriceAtCreation == 0 || loan.stakedAmount == 0) return;

    // Convert USDC (6 decimals) to BTC (8 decimals)
    // To avoid overflow, we'll multiply first by 1e8 (to get to BTC's 8 decimals) 
    // and then divide by the BTC price
    uint256 cbBtcToUnstake = (usdcAmount * 1e8) / loan.btcPriceAtCreation;

    // Cap to what is staked
    if (cbBtcToUnstake > loan.stakedAmount) {
        cbBtcToUnstake = loan.stakedAmount;
    }

    if (cbBtcToUnstake > 0) {
        _unstakeFromAave(loanId, cbBtcToUnstake, true);
        loan.stakedAmount -= cbBtcToUnstake;
    }
}


    function _swapCbBtcToUsdc(uint256 cbBtcAmount) internal returns (uint256) {
        // Approve swap router to spend cbBTC
        IERC20(cbBtcToken).approve(address(swapRouter), cbBtcAmount);
        
        // Create the token path for the swap
        address[] memory path = new address[](2);
        path[0] = cbBtcToken;
        path[1] = usdcToken;
        
        // Execute the swap with a minimum acceptable amount
        uint256 amountOutMin = cbBtcAmount * 95 / 100; // 5% slippage as placeholder
        
        uint256[] memory amounts = swapRouter.swapExactTokensForTokens(
            cbBtcAmount,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300 // 5 minutes deadline
        );
        
        return amounts[1]; // Return the amount of USDC received
    }
    
    function _updateLiquidationThreshold(bytes32 loanId) internal {
        Loan storage loan = loans[loanId];
        
        // Calculate total principal repaid so far by checking the contributions
        uint256 totalRepaidPrincipal = 0;
        for (uint256 i = 0; i < loan.contributions.length; i++) {
            totalRepaidPrincipal += loan.contributions[i].repaidPrincipal;
        }
        
        // Update remaining principal
        loan.remainingPrincipal = loan.principal - totalRepaidPrincipal;
    }

    function distributePaymentToLenders(
        Loan storage loan, 
        uint256 principalPayment, 
        uint256 interestPayment
    ) internal {
        uint256 totalPrincipal = loan.principal;
        
        for (uint256 i = 0; i < loan.contributions.length; i++) {
            LenderContribution storage lc = loan.contributions[i];
            
            // Calculate the proportion of this payment that belongs to this lender
            uint256 lenderShare = (lc.amount * 1e18) / totalPrincipal;
            uint256 lenderPrincipal = (principalPayment * lenderShare) / 1e18;
            uint256 lenderInterest = (interestPayment * lenderShare) / 1e18;
            
            // Update lender's repayment tracking
            lc.repaidPrincipal += lenderPrincipal;
            lc.repaidInterest += lenderInterest;
            
            // Transfer the payment to the lender
            IERC20(usdcToken).transfer(lc.lender, lenderPrincipal + lenderInterest);
        }
    }

    function liquidate(bytes32 loanId) external onlyOwner {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Loan is not active");

        uint256 currentBtcPrice = uint256(getPrice());
        
        // Calculate the USD value of the staked cbBTC at current price
        uint256 stakedValueInUSD = (loan.stakedAmount * currentBtcPrice) / 1e8; // Assuming 8 decimals for BTC price
        
        // Calculate the threshold: remaining principal plus 5%
        uint256 liquidationThreshold = (loan.remainingPrincipal * 105) / 100; // remaining principal + 5%
        
        // If the value of staked BTC falls below or equals threshold, liquidate
        if (stakedValueInUSD <= liquidationThreshold) {
            loan.isActive = false;
            hasActiveLoan[loan.borrower] = false;
            
          
            uint256 missedFee = (loan.remainingPrincipal * missedPaymentFeeBps) / 10000;
            if (missedFee > 0) {
                accumulatedFees += missedFee;
    
                loan.remainingPrincipal -= missedFee;
            }

            // Unstake all remaining tokens from AAVE
            if (loan.stakedAmount > 0) {
                _unstakeFromAave(loanId, loan.stakedAmount, false);
            }
            
            // Distribute borrower's deposit to lenders based on their contribution proportions
            uint256 totalDeposit = loan.borrowerDeposit;
            uint256 totalOutstandingPrincipal = loan.remainingPrincipal;
            
            if (totalOutstandingPrincipal > 0) {
                for (uint256 i = 0; i < loan.contributions.length; i++) {
                    LenderContribution storage lc = loan.contributions[i];
                    
                    // Calculate remaining principal for this lender
                    uint256 remainingPrincipal = lc.amount - lc.repaidPrincipal;
                    if (remainingPrincipal == 0) continue;
                    
                    // Calculate this lender's share of the deposit
                    uint256 lenderShare = (remainingPrincipal * 1e18) / totalOutstandingPrincipal;
                    uint256 depositShare = (totalDeposit * lenderShare) / 1e18;
                    
                    // Transfer the deposit share to the lender
                    IERC20(usdcToken).transfer(lc.lender, depositShare);
                }
            }
            
            emit LoanLiquidated(loanId, loan.borrower, currentBtcPrice);
        } else {
            revert("BTC value has not dropped below liquidation threshold");
        }
    }

    function liquidateIfOverdue(bytes32 loanId) external onlyOwner {
    Loan storage loan = loans[loanId];
    require(loan.isActive, "Loan is not active");

    uint256 totalOverdueTime = 0;
    uint256 nowTimestamp = block.timestamp;

    for (uint256 i = 0; i < loan.amortizationSchedule.length; i++) {
        Installment storage installment = loan.amortizationSchedule[i];
        if (installment.paid) continue;

        if (nowTimestamp > installment.dueTimestamp) {
            totalOverdueTime += nowTimestamp - installment.dueTimestamp;
        }
    }

    require(totalOverdueTime > 90 days, "Loan is not overdue beyond 3 months in total");

    uint256 earlyFee = (loan.remainingPrincipal * earlyClosureFeeBps) / 10000;
    if (earlyFee > 0) {
        accumulatedFees += earlyFee;
        loan.remainingPrincipal -= earlyFee;
    }

    // Mark inactive
    loan.isActive = false;
    hasActiveLoan[loan.borrower] = false;

    // Unstake everything
    if (loan.stakedAmount > 0) {
        _unstakeFromAave(loanId, loan.stakedAmount, false);
    }

    // Distribute borrower's deposit
    uint256 totalDeposit = loan.borrowerDeposit;
    uint256 totalOutstandingPrincipal = loan.remainingPrincipal;

    if (totalOutstandingPrincipal > 0) {
        for (uint256 i = 0; i < loan.contributions.length; i++) {
            LenderContribution storage lc = loan.contributions[i];
            uint256 remainingPrincipal = lc.amount - lc.repaidPrincipal;
            if (remainingPrincipal == 0) continue;

            uint256 lenderShare = (remainingPrincipal * 1e18) / totalOutstandingPrincipal;
            uint256 depositShare = (totalDeposit * lenderShare) / 1e18;

            IERC20(usdcToken).transfer(lc.lender, depositShare);
        }
    }

    emit LoanLiquidated(loanId, loan.borrower, uint256(getPrice()));
}


    // Function to update the Chainlink oracle address
    function setChainlinkOracle(address oracleAddress) external onlyOwner {
        chainlinkOracle = AggregatorV3Interface(oracleAddress);
    }
    
    // Functions to update AAVE and Swap router addresses
    function setAavePool(address _aavePool) external onlyOwner {
        aavePool = IAavePool(_aavePool);
    }
    
    function setSwapRouter(address _swapRouter) external onlyOwner {
        swapRouter = ISwapRouter(_swapRouter);
    }
    
    function setCbBtcToken(address _cbBtcToken) external onlyOwner {
        cbBtcToken = _cbBtcToken;
    }

    function debugUnstakeCalc(bytes32 loanId, uint256 principalRepaid) external view returns (
    uint256 proportionRepaid,
    uint256 cbBtcToUnstake
) {
    Loan storage loan = loans[loanId];
    if (loan.principal == 0) return (0, 0);

    proportionRepaid = (principalRepaid * 1e18) / loan.principal;
    cbBtcToUnstake = (loan.stakedAmount * proportionRepaid) / 1e18;
    return (proportionRepaid, cbBtcToUnstake);
}

function getStakedAmount(bytes32 loanId) external view returns (uint256) {
    return loans[loanId].stakedAmount;
}

function getAmortizationSchedule(bytes32 loanId) external view returns (
    uint256[] memory principals,
    uint256[] memory interests,
    bool[] memory paidStatuses
) {
    Loan storage loan = loans[loanId];
    uint256 length = loan.amortizationSchedule.length;

    principals = new uint256[](length);
    interests = new uint256[](length);
    paidStatuses = new bool[](length);

    for (uint256 i = 0; i < length; i++) {
        Installment storage installment = loan.amortizationSchedule[i];
        principals[i] = installment.duePrincipal;
        interests[i] = installment.dueInterest;
        paidStatuses[i] = installment.paid;
    }
}

function _pow(uint256 base, uint256 exp) internal pure returns (uint256 result) {
    result = 1e18;
    for (uint256 i = 0; i < exp; i++) {
        result = (result * base) / 1e18;
    }
}

function getContributions(bytes32 loanId) external view returns (
    address[] memory lenders,
    uint256[] memory amounts,
    uint256[] memory receivableInterests,
    uint256[] memory repaidPrincipals,
    uint256[] memory repaidInterests
) {
    Loan storage loan = loans[loanId];
    uint256 len = loan.contributions.length;

    lenders = new address[](len);
    amounts = new uint256[](len);
    receivableInterests = new uint256[](len);
    repaidPrincipals = new uint256[](len);
    repaidInterests = new uint256[](len);

    for (uint256 i = 0; i < len; i++) {
        LenderContribution storage c = loan.contributions[i];
        lenders[i] = c.lender;
        amounts[i] = c.amount;
        receivableInterests[i] = c.receivableInterest;
        repaidPrincipals[i] = c.repaidPrincipal;
        repaidInterests[i] = c.repaidInterest;
    }
}

function setOriginationFee(uint256 bps) external onlyOwner {
    require(bps <= 10000, "Fee too high");
    originationFeeBps = bps;
}

function setEarlyClosureFee(uint256 bps) external onlyOwner {
    require(bps <= 10000, "Fee too high");
    earlyClosureFeeBps = bps;
}

function setMissedPaymentFee(uint256 bps) external onlyOwner {
    require(bps <= 10000, "Fee too high");
    missedPaymentFeeBps = bps;
}

function withdrawAccumulatedFees(address to) external onlyOwner {
    uint256 amount = accumulatedFees;
    require(amount > 0, "No fees to withdraw");
    accumulatedFees = 0;
    IERC20(usdcToken).transfer(to, amount);
}

// --- Lender Pool Deposit/Withdraw ---
function depositToPool(uint256 amount) external {
    require(amount > 0, "Amount must be > 0");
    IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);
    IERC20(usdcToken).approve(address(aavePool), amount);
    aavePool.supply(usdcToken, amount, address(this), 0);
    lenderPoolBalance[msg.sender] += amount;
    totalPoolBalance += amount;
}

function withdrawFromPool(uint256 amount) external {
    require(amount > 0, "Amount must be > 0");
    require(lenderPoolBalance[msg.sender] >= amount, "Insufficient pool balance");
    lenderPoolBalance[msg.sender] -= amount;
    totalPoolBalance -= amount;
    uint256 withdrawn = aavePool.withdraw(usdcToken, amount, address(this));
    require(withdrawn == amount, "Withdraw mismatch");
    IERC20(usdcToken).transfer(msg.sender, amount);
}

}