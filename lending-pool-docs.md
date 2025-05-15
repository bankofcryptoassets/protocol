# LendingPool Contract Documentation

## Overview

The LendingPool contract is a decentralized lending and borrowing platform that integrates with AAVE for yield generation. It allows users to deposit USDC as lenders and borrow against BTC price movements using cbBTC tokens as collateral. The contract includes features for loan creation, repayment, and liquidation.

## Key Features

- Deposit USDC as a lender to earn interest
- Borrow USDC against BTC collateral
- Automatic staking of loans in AAVE for yield generation
- Amortization schedule for loan repayments
- Liquidation mechanism for underwater loans
- BTC price oracle integration via Chainlink

## Core Functions

### For Lenders

#### `deposit(uint256 amount)`

Deposits USDC into the lending pool to be used for loans.

**Parameters:**
- `amount`: The amount of USDC to deposit (in USDC units with 6 decimals)

**Requirements:**
- Amount must be greater than 0
- User must have approved the contract to spend their USDC

**Example:**
```javascript
// First approve the contract to spend USDC
await usdcToken.approve(lendingPoolAddress, ethers.utils.parseUnits("1000", 6));

// Then deposit 1000 USDC
await lendingPool.deposit(ethers.utils.parseUnits("1000", 6));
```

**Events:**
- Emits a `Deposit` event with the lender's address and amount

#### `withdraw(uint256 amount)`

Withdraws USDC from the lending pool that hasn't been allocated to loans.

**Parameters:**
- `amount`: The amount of USDC to withdraw (in USDC units with 6 decimals)

**Requirements:**
- User must have sufficient unallocated funds in the pool

**Example:**
```javascript
// Withdraw 500 USDC
await lendingPool.withdraw(ethers.utils.parseUnits("500", 6));
```

**Events:**
- Emits a `Withdraw` event with the lender's address and amount

### For Borrowers

#### `loan(uint256 totalAmount, uint256 durationMonths, uint256 annualInterestRate)`

Creates a new loan, collects the borrower's deposit, and distributes funds from lenders.

**Parameters:**
- `totalAmount`: Total loan amount including borrower deposit (in USDC)
- `durationMonths`: Loan duration in months
- `annualInterestRate`: Annual interest rate (in percentage points, e.g., 5 for 5%)

**Requirements:**
- Loan amount must be greater than 0
- Duration must be greater than 0
- Borrower must not already have an active loan
- Sufficient funds must be available from lenders
- Borrower must have approved the contract to spend their USDC for the 20% deposit

**Process:**
1. Creates a loan with a 20% deposit from the borrower
2. Collects funds from available lenders (oldest deposits first)
3. Swaps USDC to cbBTC tokens 
4. Stakes cbBTC in AAVE for yield generation
5. Records the BTC price at creation for liquidation calculations

**Example:**
```javascript
// First approve the contract to spend USDC for deposit (20% of 1000 = 200 USDC)
await usdcToken.approve(lendingPoolAddress, ethers.utils.parseUnits("200", 6));

// Create a 1000 USDC loan for 12 months at 5% interest
await lendingPool.loan(ethers.utils.parseUnits("1000", 6), 12, 5);
```

**Events:**
- Emits a `LoanCreated` event with the loan ID, amount, collateral, and borrower address
- Emits a `TokensStaked` event with details about the AAVE staking

#### `payouts(bytes32 loanId, uint256 usdcAmount)`

Makes a payment on a loan, applying funds to principal and interest according to the amortization schedule.

**Parameters:**
- `loanId`: The unique identifier of the loan
- `usdcAmount`: The amount of USDC to pay (in USDC units with 6 decimals)

**Requirements:**
- Loan must be active
- Only the borrower can make payments
- Borrower must have approved the contract to spend their USDC

**Process:**
1. Transfers USDC from borrower to contract
2. Converts USDC payment to BTC equivalent using Chainlink price oracle
3. Applies payment to installments in the amortization schedule
4. Distributes principal and interest to lenders based on their contribution
5. Unstakes proportional amount from AAVE and updates liquidation threshold
6. If fully repaid, deactivates the loan and unstakes all remaining funds

**Example:**
```javascript
// First approve the contract to spend USDC for repayment
await usdcToken.approve(lendingPoolAddress, ethers.utils.parseUnits("100", 6));

// Make a payment of 100 USDC
await lendingPool.payouts(loanId, ethers.utils.parseUnits("100", 6));
```

**Events:**
- Emits `InstallmentPaid` events for each installment paid
- Emits a `Payout` event with payment details
- Emits a `TokensUnstaked` event with details about AAVE unstaking

### Reading Contract Data

#### `getPrice()`

Retrieves the current BTC price from the Chainlink oracle.

**Returns:**
- `int256`: The current BTC price (using Chainlink oracle's decimal precision)

**Example:**
```javascript
// Get the current BTC price
const price = await lendingPool.getPrice();
console.log(`Current BTC price: ${price}`);
```

#### `getInstallmentSchedule(bytes32 loanId)`

Gets the full amortization schedule for a loan.

**Parameters:**
- `loanId`: The unique identifier of the loan

**Returns:**
- Array of `Installment` objects containing:
  - `duePrincipal`: Principal amount due for installment
  - `dueInterest`: Interest amount due for installment
  - `paid`: Boolean indicating if installment has been paid

**Example:**
```javascript
// Get the installment schedule for a loan
const schedule = await lendingPool.getInstallmentSchedule(loanId);
console.log('Amortization Schedule:', schedule);
```

## Data Structures

### Loan

- `id`: Unique identifier for the loan (bytes32)
- `borrower`: Address of the borrower
- `principal`: Loan principal amount (80% of total loan)
- `borrowerDeposit`: Amount deposited by borrower (20% of total loan)
- `interestRate`: Annual interest rate
- `duration`: Loan duration in months
- `monthlyPayment`: Calculated monthly payment amount
- `startTime`: Timestamp when loan was created
- `btcPriceAtCreation`: BTC price at loan creation for liquidation calculations
- `isActive`: Boolean indicating if loan is active
- `contributions`: Array of lender contributions
- `amortizationSchedule`: Array of installment payment details
- `stakedAmount`: Amount of cbBTC staked in AAVE
- `remainingPrincipal`: Tracking remaining principal after repayments

### Installment

- `duePrincipal`: Principal amount due for this installment
- `dueInterest`: Interest amount due for this installment
- `paid`: Boolean indicating if installment has been paid

### Lender

- `deposit`: Total amount deposited by lender
- `totalContributed`: Total amount contributed to loans
- `remainingDeposit`: Amount not yet allocated to loans
- `depositTimestamp`: Timestamp of deposit for FIFO allocation

## Events

- `Deposit(address indexed lender, uint256 amount)`: Emitted when a lender deposits funds
- `Withdraw(address indexed lender, uint256 amount)`: Emitted when a lender withdraws funds
- `LoanCreated(bytes32 id, uint256 amount, uint256 collateral, address borrower)`: Emitted when a loan is created
- `LoanLiquidated(bytes32 id, address borrower, uint256 btcPriceNow)`: Emitted when a loan is liquidated
- `Payout(bytes32 loanId, address borrower, uint256 amount, bool fullyRepaid)`: Emitted when a loan payment is made
- `InstallmentPaid(bytes32 loanId, uint256 index)`: Emitted when an installment is paid
- `TokensStaked(bytes32 loanId, uint256 usdcAmount, uint256 cbBtcAmount)`: Emitted when tokens are staked in AAVE
- `TokensUnstaked(bytes32 loanId, uint256 cbBtcAmount, uint256 usdcAmount, uint256 borrowerCbBtcShare)`: Emitted when tokens are unstaked from AAVE

## Liquidation Mechanism

The contract monitors BTC price movements and can liquidate loans if the collateral value falls below threshold:

- Liquidation threshold: Remaining principal + 5%
- Collateral value: Current BTC price × staked cbBTC amount
- Liquidation occurs when collateral value ≤ liquidation threshold
- On liquidation, the borrower's deposit is distributed to lenders proportionally

## Integration Points

- AAVE: Used for staking cbBTC tokens to generate yield
- Chainlink: BTC price oracle for valuation and liquidation calculations
- Swap Router: Used to swap between USDC and cbBTC tokens

## Implementation Notes for Frontend Team

1. Always check for transaction approval before calling contract functions
2. Monitor events to track transaction status and update UI
3. Use `getPrice()` to display current BTC price and loan health
4. Calculate liquidation thresholds client-side to warn users of potential liquidations
5. Use `getInstallmentSchedule()` to display payment schedule to borrowers