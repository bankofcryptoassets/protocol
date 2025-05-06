// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IUniswap {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IStorkVerifier {
    function verifyStorkSignatureV1(
        address storkPubKey,
        bytes32 id,
        uint256 recvTime,
        int256 quantizedValue,
        bytes32 publisherMerkleRoot,
        bytes32 valueComputeAlgHash,
        uint256 value,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) external returns (bool);
}

// USDC address : 0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA
// WBTC Address : 0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93
// Uniswap Router : 0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A

contract LendingPool {
    // address public usdcToken = 0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA;
    // address public wbtctoken = 0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93;
    // address public uniswapRouter = 0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A;
    address public storkVerifier = 0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62;
    uint256 public poolBalance;
    uint256 public exchangeRate; // USDC per BTC

    struct Lender {
        uint256 deposit;
        uint256 totalContributed;
        uint256 remainingDeposit; // Deposit - Contributed
    }

    struct Deposit {
        bytes32 id;
        address lender;
        uint256 amount;
        uint256 duration;
        uint256 interest;
        uint256 depositBalance;
        uint256 receieveAmount;
    }

    struct Loan {
        bytes32 id;
        uint256 amount;
        uint256 collateral;
        uint256 interest;
        address borrower;
        address[] lenders;
        uint256[] amounts;
        uint256[] receivablePrincipal;
        uint256[] receivableInterest;
        uint256[] contributionRatios;
        uint256 remainingCollateral;
        uint256 remainingAsset;
        bool isActive;
        uint256 duration;
    }

    mapping(address => Lender) public lenders;
    mapping(bytes32 => Loan) public loans;
    mapping(address => uint256) public assetPrice;
    uint256 public loanCount;

    address[] public lendersList;
    bytes32[] public depositsList;
    bytes32[] public loansList;

    address public owner;

    address public usdcToken;
    address public wbtctoken;
    address public uniswapRouter;

    constructor(address usdc, address wbtc, address router) {
        owner = msg.sender;
        usdcToken = usdc;
        wbtctoken = wbtc;
        uniswapRouter = router;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    receive() external payable {}

    event DepositEvent(
        bytes32 id,
        address indexed lender,
        uint256 amount,
        uint256 duration,
        uint256 interest,
        uint256 depositBalance
    );

    event LoanCreated(
        bytes32 id,
        uint256 amount,
        uint256 collateral,
        address indexed borrower,
        address[] lenders
    );

    event Payout(
        bytes32 loanId,
        address borrower,
        uint256 amount,
        bool fullyRepaid
    );

    function setPrice(
        address asset,
        address storkPubKey,
        bytes32 id,
        uint256 recvTime,
        int256 quantizedValue,
        bytes32 publisherMerkleRoot,
        bytes32 valueComputeAlgHash,
        uint256 value,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) public onlyOwner {
        bool result = IStorkVerifier(storkVerifier).verifyStorkSignatureV1(
            storkPubKey,
            id,
            recvTime,
            quantizedValue,
            publisherMerkleRoot,
            valueComputeAlgHash,
            value,
            r,
            s,
            v
        );

        if (result) {
            exchangeRate = value;
            assetPrice[asset] = value;
        }
    }

    function getPrice(address asset) external view returns (uint256) {
        return assetPrice[asset];
    }

    // Deposit function for lenders
    function deposit(
        address asset,
        uint256 amount,
        uint256 interest,
        uint256 duration
    ) external returns (Deposit memory) {
        // Get Price of Asset
        uint256 price = assetPrice[asset];
        // Transfer USDC from lender to contract
        IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);
        // Create a unique ID for the deposit
        bytes32 id = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        // Update the lender’s deposit balance
        lenders[msg.sender].deposit += amount;
        // Update pool's balance
        poolBalance += amount;
        // Calculate the amount the lender will receive after the duration
        uint256 receieveAmount = amount + (amount * interest) / 100;
        // Create a deposit object
        Deposit memory depositAction = Deposit(
            id,
            msg.sender,
            amount,
            duration,
            interest,
            poolBalance,
            receieveAmount
        );
        // Create a lender object
        Lender memory lender = Lender(amount, 0, amount);
        // Add the lender to the lenders mapping
        lenders[msg.sender] = lender;
        // Add the deposit to the deposits list
        depositsList.push(id);

        // Add the lender to the lenders list
        lendersList.push(msg.sender);

        // Emit a deposit event
        emit DepositEvent(
            id,
            msg.sender,
            amount,
            duration,
            interest,
            poolBalance
        );

        return depositAction;
    }

    // Create a loan function: Iterate over the lenders whose deposits are available for the given duration and calculate how much collateral they can provide and
    // then create a loan object by calculating each lenders contribution ratio
    // and the net receivables based on the interest rate of loan and the total receivables per lender with total principal, total interest and total amount and the liquidation factor based on collateral
    function loan(
        uint256 amount,
        uint256 duration,
        uint256 interestRate
    ) external {
        require(amount > 0, "Loan amount must be greater than 0");
        require(duration > 0, "Duration should be greater than 0");

        // Calculate collateral
        uint256 usdcCollateral = (amount * 20) / 100;
        uint256 remainingCollateral = usdcCollateral * 4;
        uint256 totalCollateral = usdcCollateral + remainingCollateral;

        // Transfer USDC collateral from borrower
        IERC20(usdcToken).transferFrom(
            msg.sender,
            address(this),
            usdcCollateral
        );

        // Iterate over lenders and collect contributions
        address[] memory lenderAddresses = new address[](lendersList.length);
        uint256[] memory lenderAmounts = new uint256[](lendersList.length);
        uint256[] memory receivablePrincipal = new uint256[](
            lendersList.length
        );
        uint256[] memory receivableInterest = new uint256[](lendersList.length);
        uint256[] memory contributionRatios = new uint256[](lendersList.length);

        uint256 collectedAmount = 0;

        for (uint256 i = 0; i < lendersList.length; i++) {
            if (collectedAmount >= amount) break;

            address lender = lendersList[i];
            uint256 deposit = lenders[lender].remainingDeposit;

            if (deposit > 0) {
                uint256 contribution = deposit <= (amount - collectedAmount)
                    ? deposit
                    : (amount - collectedAmount);

                lenderAddresses[i] = lender;
                lenderAmounts[i] = contribution;

                // Calculate receivable principal and interest
                receivablePrincipal[i] = contribution;
                receivableInterest[i] = (contribution * interestRate) / 100;
                contributionRatios[i] = (contribution * 1e18) / amount;

                collectedAmount += contribution;
                lenders[lender].remainingDeposit -= contribution;
            }
        }

        require(collectedAmount >= amount, "Insufficient lender liquidity");

        // Swap USDC for WBTC via Uniswap
        address[] memory path = new address[](2);
        path[0] = usdcToken;
        path[1] = wbtctoken;

        IUniswap(uniswapRouter).swapExactTokensForTokens(
            usdcCollateral,
            0,
            path,
            address(this),
            block.timestamp + 2
        );

        // Create loan object
        bytes32 loanId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp)
        );
        Loan memory newLoan = Loan({
            id: loanId,
            amount: amount,
            collateral: totalCollateral,
            interest: interestRate,
            borrower: msg.sender,
            lenders: lenderAddresses,
            amounts: lenderAmounts,
            receivablePrincipal: receivablePrincipal,
            receivableInterest: receivableInterest,
            contributionRatios: contributionRatios,
            remainingCollateral: totalCollateral,
            remainingAsset: 0,
            duration: duration + block.timestamp,
            isActive: true
        });
        loans[loanId] = newLoan;

        emit LoanCreated(
            loanId,
            amount,
            totalCollateral,
            msg.sender,
            lenderAddresses
        );
    }

    // A function to repay the loan
    function payouts(bytes32 loanId, uint256 usdcAmount) external {
        Loan storage loan = loans[loanId];
        require(loan.isActive, "Loan is not active");
        require(
            msg.sender == loan.borrower,
            "Only the borrower can repay the loan"
        );

        // Transfer USDC from borrower to contract
        IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount);

        uint256 totalPayment = usdcAmount;

        for (uint256 i = 0; i < loan.lenders.length; i++) {
            // Calculate the principal receivable based on the contribution ratio
            uint256 principalPayment = (loan.contributionRatios[i] *
                loan.amount) / 1e18;

            // Get the interest receivable for the lender
            uint256 interestPayment = loan.receivableInterest[i];

            // Total payment for this lender
            uint256 lenderPayment = principalPayment + interestPayment;

            if (totalPayment < lenderPayment) {
                // If insufficient funds to fully pay this lender, split proportionally
                uint256 proportionalPrincipal = (totalPayment *
                    principalPayment) / lenderPayment;
                uint256 proportionalInterest = (totalPayment *
                    interestPayment) / lenderPayment;

                IERC20(usdcToken).transfer(
                    loan.lenders[i],
                    proportionalPrincipal + proportionalInterest
                );

                // Adjust remaining receivables
                loan.receivablePrincipal[i] -= proportionalPrincipal;
                loan.receivableInterest[i] -= proportionalInterest;

                totalPayment = 0;
                break;
            } else {
                // Fully pay this lender
                IERC20(usdcToken).transfer(loan.lenders[i], lenderPayment);

                // Reduce total payment
                totalPayment -= lenderPayment;

                // Mark this lender's receivables as 0
                loan.receivablePrincipal[i] -= principalPayment;
                loan.receivableInterest[i] -= interestPayment;
            }
        }

        // Check if the loan is fully repaid
        bool fullyRepaid = true;
        for (uint256 i = 0; i < loan.receivablePrincipal.length; i++) {
            if (
                loan.receivablePrincipal[i] > 0 ||
                loan.receivableInterest[i] > 0
            ) {
                fullyRepaid = false;
                break;
            }
        }

        if (fullyRepaid) {
            loan.isActive = false;
        }

        emit Payout(loanId, msg.sender, usdcAmount, fullyRepaid);
    }

    // A function to give available liquidity for a given time duration
    function availableLiquidity() public view returns (uint256) {
        uint256 totalDeposits = 0;

        // Sum up all lender deposits
        for (uint256 i = 0; i < lendersList.length; i++) {
            totalDeposits += lenders[lendersList[i]].remainingDeposit;
        }

        return totalDeposits;
    }
}
