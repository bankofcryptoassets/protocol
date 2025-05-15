# 📘 Lending & Borrowing API Documentation

This API provides access to a decentralized lending and borrowing platform. It allows frontend clients to fetch lending/loan data, calculate loan terms, check loan availability, and get user-specific dashboards.

---

## 📋 Table of Contents

* [User Routes](#user-routes)
* [Loan Routes](#loan-routes)
* [Lending Routes](#lending-routes)
* [Payment Routes](#payment-routes)
* [Loan Tools](#loan-tools)
* [Auth & Middleware](#auth--middleware)
* [Error Format](#error-format)
* [Notes](#notes)

---

## 👤 User Routes

### `GET /api/user` *(Protected)*

**Description:** Get the currently logged-in user's details.
**Returns:**

```json
{
  "_id": "user_id",
  "user_address": "0x123...",
  "loans": [ /* Array of Loan objects */ ],
  "lends": [ /* Array of Lend objects */ ],
  "payments": [ /* Array of Payment objects */ ],
  "withdraws": [ /* Optional Withdraw info */ ]
}
```

**Returns:** User object with populated `lends`, `loans`, `payments`, `withdraws`.

### `PATCH /api/user/:id` *(Protected)*

**Description:** Update user details.
**Body:** Fields to update (`email`, `name`, etc.).

### `GET /api/user/admin` *(Protected)*

**Description:** Get all users (admin only).

<a name="get-dashboard"></a>

### `GET /api/user/dashboard?user_address=0x...` *(Protected)*

**Description:** Get aggregated dashboard data for a user.
**Returns:**

```json
{
  "user_address": "0x...",
  "loans": [ ... ],
  "lendings": [ ... ],
  "payments": [ ... ],
  "stats": {
    "totalLent": 500,
    "totalInterestEarned": 40,
    "totalReturns": 540,
    "totalBorrowed": 800
  }
}
```

---

## 💸 Loan Routes

### `GET /api/loan` *(Protected)*

**Description:** Get all loans of the current user.
**Returns:**

```json
[
  {
    "_id": "loan_id",
    "loan_id": "abc123",
    "user_id": {
      "_id": "user_id",
      "user_address": "0x123..."
    },
    "loan_amount": 1000,
    "up_front_payment": 200,
    "total_amount_payable": 1080,
    "remaining_amount": 900,
    "collateral": 250,
    "asset": "BTC",
    "asset_borrowed": 0.02,
    "asset_remaining": 0.015,
    "asset_price": 48000,
    "asset_released_per_month": 0.001,
    "chain_id": 1,
    "interest_rate": 8.0,
    "loan_duration": 12,
    "number_of_monthly_installments": 12,
    "interest": 80,
    "monthly_payable_amount": 90,
    "interest_payable_month": 6.67,
    "principal_payable_month": 83.33,
    "liquidation_factor": 0.7,
    "lends": ["lend_id_1", "lend_id_2"],
    "receivable_amount_By_lenders": [500, 500],
    "receivable_interest_by_lenders": 80,
    "payments": ["payment_id_1"],
    "openedOn": "2024-01-01T00:00:00.000Z",
    "lenders_capital_invested": [
      {
        "lend_id": "lend_id_1",
        "user_id": "lender_1",
        "user_address": "0xabc...",
        "amount": 500,
        "amount_received": 250,
        "received_interest": 20,
        "total_received": 270,
        "remaining_amount": 230
      }
    ],
    "receivable_amount_monthly_by_lenders": [
      {
        "lend_id": "lend_id_1",
        "user_id": "lender_1",
        "amount": 500,
        "interest": 20,
        "total_amount": 520,
        "remaining_amount": 270
      }
    ],
    "withdrawable_by_user": [
      {
        "user_id": "lender_1",
        "amount": 100
      }
    ],
    "last_payment_date": "2024-04-01T00:00:00.000Z",
    "next_payment_date": "2024-05-01T00:00:00.000Z",
    "months_not_paid": 0,
    "bounce": false,
    "loan_end": "2025-01-01T00:00:00.000Z",
    "amortization_schedule": [
      {
        "duePrincipal": 83.33,
        "dueInterest": 6.67,
        "paid": false
      }
    ],
    "liquidation_price": 34000,
    "is_active": true,
    "is_liquidated": false,
    "is_repaid": false,
    "is_defaulted": false
  }
]
```

**Returns:** Loans populated with lenders and borrower info.

### `GET /api/loan/:id`

**Description:** Get a specific loan by ID.

### `GET /api/initialisation/check/liquidity` *(Protected)*

**Description:** Returns liquidity and other initial details for loan processing.

---

## 🤝 Lending Routes

### `GET /api/lending` *(Protected)*

**Description:** Get all lendings of the logged-in user.
**Returns:**

```json
[
  {
    "_id": "lend_id",
    "user_id": "user_id",
    "loan_id": "loan_id",
    "amount": 500,
    "received_interest": 30,
    "total_received": 530
  }
]
```

### `GET /api/lending/:id`

**Description:** Get specific lending details by ID.

---

## 💳 Payment Routes

### `GET /api/payment` *(Protected)*

**Description:** Get all payments of the logged-in user.
**Returns:**

```json
[
  {
    "_id": "payment_id",
    "loan_id": "loan_id",
    "userId": "user_id",
    "amount": 100,
    "timestamp": "2024-12-01T00:00:00Z"
  }
]
```

### `GET /api/payment/:id`

**Description:** Get specific payment record by ID.

---

## 📈 Loan Tools

<a name="post-loansummary"></a>

### `POST /api/initialisation/loansummary`

**Description:** Get a loan amortization summary based on input.
**Body:**

```json
{
  "amount": 0.5,
  "term": 12,
  "interestRate": 8.5
}
```

**Returns:**

```json
{
  "status": "success",
  "data": {
    "loanSummary": {
      "loanAmount": 24000,
      "downPayment": "4800.00",
      "openingFee": "192.00",
      "upfrontPayment": "4992.00",
      "principal": "19200.00",
      "monthlyPayment": "1674.56",
      "totalInterest": "828.76",
      "totalPayment": "20094.76",
      "apr": "8.88",
      "interestRate": 8.5,
      "term": 12,
      "amortizationSchedule": [
        { "month": 1, "interestPayment": "136.00", "principalPayment": "1538.56", "remainingBalance": "17661.44" },
        ...
      ],
      "firstTransaction": {
        "amountSent": "4992.00",
        "breakdown": {
          "downPayment": "4800.00",
          "loanOpeningFee": "192.00"
        }
      }
    }
  }
}
```

* Monthly payment
* Down payment (20%)
* Opening fee (1%)
* Amortization schedule
* Total interest, APR

### `GET /api/initialisation/loanavailability`

**Description:** Check how much BTC is currently available to lend.
**Returns:**

```json
{ "availableLoanAmountInBTC": "2.10" }
```

### `GET /api/initialisation/getbtcprice?amount=1`

**Description:** Convert given USD amount to BTC equivalent.

### `GET /api/initialisation/getusdprice?amount=1`

**Description:** Convert given BTC amount to USD equivalent.

---

## 🛡 Auth & Middleware

Routes marked with *(Protected)* require authentication middleware: `isLoggedIn`. Use bearer tokens:

```http
Authorization: Bearer <jwt_token>
```

---

## ❌ Error Format

All error responses return:

```json
{
  "error": "Error message here"
}
```

---

## 📌 Notes

* All MongoDB documents are populated with references (`user_id`, `loans`, `lends`).
* Use [`GET /api/user/dashboard`](#get-dashboard) to power profile views.
* Use `POST /api/initialisation/loansummary` to simulate EMI/loan breakdowns.
* Keep JWT active for all protected routes.

---
