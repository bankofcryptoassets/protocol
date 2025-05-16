// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

    // Events
    event LoanCreated(bytes32 id, uint256 amount, uint256 collateral, address borrower);
    event LoanLiquidated(bytes32 id, address borrower, uint256 btcPriceNow);
    event Payout(bytes32 loanId, address borrower, uint256 amount, bool fullyRepaid);
    event InstallmentPaid(bytes32 loanId, uint256 index);
    event TokensStaked(bytes32 loanId, uint256 usdcAmount, uint256 cbBtcAmount);
    event TokensUnstaked(bytes32 loanId, uint256 cbBtcAmount, uint256 usdcAmount, uint256 borrowerCbBtcShare);

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
    }

    function getPrice() public view returns (int256) {
        (, int256 answer,,,) = chainlinkOracle.latestRoundData();
        return answer;
    }

    function loan(
        uint256 totalAmount, 
        uint256 durationMonths, 
        uint256 annualInterestRate, 
        address[] calldata lenderAddresses, 
        uint256[] calldata lenderAmounts
    ) external {
        require(totalAmount > 0, "Invalid amount");
        require(durationMonths > 0, "Invalid duration");
        require(!hasActiveLoan[msg.sender], "Borrower already has an active loan");
        require(lenderAddresses.length == lenderAmounts.length, "Lender addresses and amounts length mismatch");
        require(lenderAddresses.length > 0, "No lenders provided");

        // Create loan and collect deposit
        bytes32 loanId = _createLoan(totalAmount, durationMonths, annualInterestRate, lenderAddresses, lenderAmounts);
        
        // Loan is created, now transfer the loan amount to the borrower
        Loan storage newLoan = loans[loanId];
        
        // Swap USDC to cbBTC
        uint256 cbBtcAmount = _swapUsdcToCbBtc(newLoan.principal);
        
        // Stake cbBTC to AAVE
        _stakeCbBtcToAave(loanId, cbBtcAmount);
        
        emit LoanCreated(loanId, totalAmount, newLoan.borrowerDeposit, msg.sender);
    }
    
    function _swapUsdcToCbBtc(uint256 usdcAmount) internal returns (uint256) {
        // Approve swap router to spend USDC
        IERC20(usdcToken).approve(address(swapRouter), usdcAmount);
        
        // Create the token path for the swap
        address[] memory path = new address[](2);
        path[0] = usdcToken;
        path[1] = cbBtcToken;
        
        // Execute the swap with a minimum acceptable amount (this should be calculated based on price impact)
        uint256 amountOutMin = usdcAmount * 95 / 100; // 5% slippage as placeholder
        
        uint256[] memory amounts = swapRouter.swapExactTokensForTokens(
            usdcAmount,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300 // 5 minutes deadline
        );
        
        return amounts[1]; // Return the amount of cbBTC received
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
        uint256 annualInterestRate,
        address[] calldata lenderAddresses,
        uint256[] calldata lenderAmounts
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
        newLoan.principal = lenderPrincipal;
        newLoan.borrowerDeposit = borrowerDeposit;
        newLoan.interestRate = annualInterestRate;
        newLoan.duration = durationMonths;
        newLoan.startTime = block.timestamp;
        newLoan.btcPriceAtCreation = uint256(getPrice());
        newLoan.isActive = true;
        newLoan.remainingPrincipal = lenderPrincipal;
        
        // Collect funds from the provided lenders
        uint256 collected = 0;
        
        for (uint256 i = 0; i < lenderAddresses.length; i++) {
            address lender = lenderAddresses[i];
            uint256 amount = lenderAmounts[i];
            
            require(amount > 0, "Invalid lender amount");
            
            // Transfer funds from lender to contract
            IERC20(usdcToken).transferFrom(lender, address(this), amount);
            
            collected += amount;
            
            // Update lender's total contributed
            lenders[lender].totalContributed += amount;
            
            // Calculate interest for this lender
            uint256 interestReceivable = (amount * annualInterestRate * durationMonths) / (12 * 100);
            
            // Add contribution to loan
            newLoan.contributions.push(LenderContribution({
                lender: lender,
                amount: amount,
                receivableInterest: interestReceivable,
                repaidPrincipal: 0,
                repaidInterest: 0
            }));
        }
        
        require(collected == lenderPrincipal, "Collected amount doesn't match principal");

        // Calculate monthly payment
        uint256 monthlyRate = (annualInterestRate * 1e18) / (12 * 100);
        newLoan.monthlyPayment = (lenderPrincipal * monthlyRate) / (1e18 - (1e18 / (1e18 + monthlyRate)) ** durationMonths);
        
        // Create amortization schedule
        _createAmortizationSchedule(loanId, lenderPrincipal, monthlyRate, durationMonths);
        
        loanIds.push(loanId);
        hasActiveLoan[msg.sender] = true;
        
        return loanId;
    }
    
    function _createAmortizationSchedule(bytes32 loanId, uint256 principal, uint256 monthlyRate, uint256 months) internal {
        Loan storage loan = loans[loanId];
        uint256 remainingPrincipal = principal;
        uint256 payment = loan.monthlyPayment;
        
        for (uint256 m = 0; m < months; m++) {
            uint256 interest = (remainingPrincipal * monthlyRate) / 1e18;
            uint256 principalPortion = payment - interest;
            
            // Handle final payment to ensure full repayment
            if (m == months - 1) {
                principalPortion = remainingPrincipal;
                payment = principalPortion + interest;
            }
            
            loan.amortizationSchedule.push(Installment({
                duePrincipal: principalPortion,
                dueInterest: interest,
                paid: false,
                dueTimestamp: block.timestamp + (m * 30 days) // Assuming monthly payments
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

        // Transfer USDC from borrower to this contract
        IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount);

        // Get current BTC price in USDC (e.g., 1 BTC = 50,000 * 1e6 USDC if USDC has 6 decimals)
        uint256 btcPrice = loan.btcPriceAtCreation;
        require(btcPrice > 0, "Invalid BTC price");

        // Convert USDC to BTC (ensure same decimal scaling)
        uint256 btcEquivalent = (usdcAmount * 1e18) / uint256(btcPrice);

        uint256 remainingBtcPayment = btcEquivalent;
        uint256 totalPrincipalRepaid = 0;

        // Apply payment to amortization schedule
        for (uint256 i = 0; i < loan.amortizationSchedule.length && remainingBtcPayment > 0; i++) {
            Installment storage installment = loan.amortizationSchedule[i];
            if (installment.paid) continue;

            uint256 installmentTotal = installment.duePrincipal + installment.dueInterest;

            if (remainingBtcPayment >= installmentTotal) {
                // Full installment payment
                installment.paid = true;
                remainingBtcPayment -= installmentTotal;
                totalPrincipalRepaid += installment.duePrincipal;

                // Distribute principal + interest to lenders
                distributePaymentToLenders(loan, installment.duePrincipal, installment.dueInterest);

                emit InstallmentPaid(loanId, i);
            } else {
                // Partial payment not yet supported
                break;
            }
        }

        // Update remaining principal on the loan
        loan.remainingPrincipal -= totalPrincipalRepaid;

        // Unstake from AAVE based on principal repaid
        if (totalPrincipalRepaid > 0) {
            _unstakeProportionalAmount(loanId, totalPrincipalRepaid);
            _updateLiquidationThreshold(loanId);
        }

        // Check if loan is now fully repaid
        bool fullyRepaid = true;
        for (uint256 i = 0; i < loan.amortizationSchedule.length; i++) {
            if (!loan.amortizationSchedule[i].paid) {
                fullyRepaid = false;
                break;
            }
        }

        if (fullyRepaid) {
            loan.isActive = false;
            hasActiveLoan[loan.borrower] = false;

            // Unstake any remaining amount from AAVE
            if (loan.stakedAmount > 0) {
                _unstakeFromAave(loanId, loan.stakedAmount, false);
            }
        }

        emit Payout(loanId, msg.sender, usdcAmount, fullyRepaid);
    }

    function _unstakeProportionalAmount(bytes32 loanId, uint256 principalRepaid) internal {
        Loan storage loan = loans[loanId];
        
        // Calculate what proportion of the initial principal has been repaid in this transaction
        uint256 proportionRepaid = (principalRepaid * 1e18) / loan.principal;
        
        // Calculate how much cbBTC to unstake
        uint256 cbBtcToUnstake = (loan.stakedAmount * proportionRepaid) / 1e18;
        
        if (cbBtcToUnstake > 0) {
            _unstakeFromAave(loanId, cbBtcToUnstake, true);
        }
    }
    
    function _unstakeFromAave(bytes32 loanId, uint256 cbBtcAmount, bool returnToBorrower) internal {
        Loan storage loan = loans[loanId];
        require(cbBtcAmount <= loan.stakedAmount, "Cannot unstake more than staked amount");
        
        // Withdraw cbBTC from AAVE
        uint256 actualWithdrawn = aavePool.withdraw(cbBtcToken, cbBtcAmount, address(this));
        
        // Update staked amount
        loan.stakedAmount -= actualWithdrawn;
        
        if (returnToBorrower) {
            // Return a percentage of cbBTC to borrower (25% as a placeholder - this can be adjusted)
            uint256 borrowerShare = actualWithdrawn * 25 / 100;
            uint256 contractShare = actualWithdrawn - borrowerShare;
            
            // Transfer borrower's share of cbBTC directly to them
            IERC20(cbBtcToken).transfer(loan.borrower, borrowerShare);
            
            // Swap contract's share of cbBTC to USDC 
            uint256 usdcReceived = _swapCbBtcToUsdc(contractShare);
            
            emit TokensUnstaked(loanId, actualWithdrawn, usdcReceived, borrowerShare);
        } else {
            // Swap all cbBTC back to USDC (for liquidations or full repayments)
            uint256 usdcReceived = _swapCbBtcToUsdc(actualWithdrawn);
            
            emit TokensUnstaked(loanId, actualWithdrawn, usdcReceived, 0);
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
}