// interest rate is 5%
const express = require("express");
const cron = require("node-cron");

const { connectDB } = require("./utils/db");
const userRouter = require("./routes/userRouter");
const authRouter = require("./routes/authRouter");
const loanRouter = require("./routes/loanRouter");
const paymentRouter = require("./routes/paymentRouter");
const lendingRouter = require("./routes/lendRouter");
const loanInitialisationRouter = require("./routes/initialisationRouter");

const { seralizeUser } = require("./controllers/authController");
const { recordDeposit } = require("./Listeners/deposit");
const { recordLoanEvents } = require("./Listeners/loan");
const { recordPayoutEvents } = require("./Listeners/payment");

const app = express();
// connectDB();

// schedule cron for every 5 seconds
// cron.schedule("*/5 * * * * *", async () => {
//   await recordDeposit();
//   await recordLoanEvents();
//   await recordPayoutEvents();
// });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(seralizeUser);

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/loan", loanRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/lending", lendingRouter);
app.use("/api/initialisation", loanInitialisationRouter);

app.get("/", async (req, res) => {
  return res.json({ message: "Hello World" });
});

app.listen(5001, () => {
  console.log("Server started on port 5001");
});
