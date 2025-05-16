# 📘 Lending & Borrowing API Documentation

This API provides access to a decentralized lending and borrowing platform. It allows frontend clients to fetch lending/loan data, calculate loan terms, check loan availability, and get user-specific dashboards.

---

## 📋 Table of Contents

* [User Routes](#-user-routes)
* [Loan Routes](#-loan-routes)
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
  "amount": 1,
  "term": 12,
  "interestRate": 7
}
```

**Returns:**

```json
{
  "status": "success",
  "data": {
    "loanSummary": {
      "loanAmount": 103405.764,
      "downPayment": "20681.15",
      "openingFee": "827.25",
      "upfrontPayment": "21508.40",
      "principal": "82724.61",
      "monthlyPayment": "7157.89",
      "totalInterest": "3170.09",
      "totalPayment": "85894.70",
      "apr": "7.00",
      "interestRate": 7,
      "term": 12,
      "amortizationSchedule": [
        {
          "month": 1,
          "interestPayment": "482.56",
          "principalPayment": "6675.33",
          "remainingBalance": "76049.28",
          "btcRedeemed": "0.06455473",
          "remainingBtcCollateral": "0.93544527",
          "liquidationPrice": "81297.41"
        },
        {
          "month": 2,
          "interestPayment": "443.62",
          "principalPayment": "6714.27",
          "remainingBalance": "69335.01",
          "btcRedeemed": "0.06493130",
          "remainingBtcCollateral": "0.87051397",
          "liquidationPrice": "79648.36"
        },
        {
          "month": 3,
          "interestPayment": "404.45",
          "principalPayment": "6753.44",
          "remainingBalance": "62581.57",
          "btcRedeemed": "0.06531007",
          "remainingBtcCollateral": "0.80520390",
          "liquidationPrice": "77721.40"
        },
        {
          "month": 4,
          "interestPayment": "365.06",
          "principalPayment": "6792.83",
          "remainingBalance": "55788.74",
          "btcRedeemed": "0.06569104",
          "remainingBtcCollateral": "0.73951286",
          "liquidationPrice": "75439.85"
        },
        {
          "month": 5,
          "interestPayment": "325.43",
          "principalPayment": "6832.46",
          "remainingBalance": "48956.28",
          "btcRedeemed": "0.06607424",
          "remainingBtcCollateral": "0.67343863",
          "liquidationPrice": "72695.98"
        },
        {
          "month": 6,
          "interestPayment": "285.58",
          "principalPayment": "6872.31",
          "remainingBalance": "42083.97",
          "btcRedeemed": "0.06645967",
          "remainingBtcCollateral": "0.60697895",
          "liquidationPrice": "69333.49"
        },
        {
          "month": 7,
          "interestPayment": "245.49",
          "principalPayment": "6912.40",
          "remainingBalance": "35171.57",
          "btcRedeemed": "0.06684735",
          "remainingBtcCollateral": "0.54013160",
          "liquidationPrice": "65116.66"
        },
        {
          "month": 8,
          "interestPayment": "205.17",
          "principalPayment": "6952.72",
          "remainingBalance": "28218.84",
          "btcRedeemed": "0.06723730",
          "remainingBtcCollateral": "0.47289431",
          "liquidationPrice": "59672.62"
        },
        {
          "month": 9,
          "interestPayment": "164.61",
          "principalPayment": "6993.28",
          "remainingBalance": "21225.56",
          "btcRedeemed": "0.06762951",
          "remainingBtcCollateral": "0.40526479",
          "liquidationPrice": "52374.55"
        },
        {
          "month": 10,
          "interestPayment": "123.82",
          "principalPayment": "7034.08",
          "remainingBalance": "14191.49",
          "btcRedeemed": "0.06802402",
          "remainingBtcCollateral": "0.33724077",
          "liquidationPrice": "42081.17"
        },
        {
          "month": 11,
          "interestPayment": "82.78",
          "principalPayment": "7075.11",
          "remainingBalance": "7116.38",
          "btcRedeemed": "0.06842083",
          "remainingBtcCollateral": "0.26881995",
          "liquidationPrice": "26472.66"
        },
        {
          "month": 12,
          "interestPayment": "41.51",
          "principalPayment": "7116.38",
          "remainingBalance": "0.00",
          "btcRedeemed": "0.06881995",
          "remainingBtcCollateral": "0.20000000",
          "liquidationPrice": "0.00"
        }
      ],
      "firstTransaction": {
        "amountSent": "21508.40",
        "breakdown": {
          "downPayment": "20681.15",
          "loanOpeningFee": "827.25"
        }
      },
      "liquidationChart": {
        "months": [
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12
        ],
        "liquidationPrices": [
          82724.61,
          81297.41,
          79648.36,
          77721.4,
          75439.85,
          72695.98,
          69333.49,
          65116.66,
          59672.62,
          52374.55,
          42081.17,
          26472.66,
          0
        ]
      },
      "initialBtcCollateral": "1.00000000",
      "currentBtcPrice": "103405.76"
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
