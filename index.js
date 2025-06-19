// interest rate is 5%
const express = require("express");
const cron = require("node-cron");
const cors = require("cors");

const { connectDB } = require("./utils/db");
const { bot } = require("./utils/telegramMessager");
const userRouter = require("./routes/userRouter");
const authRouter = require("./routes/authRouter");
const loanRouter = require("./routes/loanRouter");
const paymentRouter = require("./routes/paymentRouter");
const lendingRouter = require("./routes/lendRouter");
const loanInitialisationRouter = require("./routes/initialisationRouter");
const insuranceRouter = require("./routes/insuranceRouter");

const { seralizeUser } = require("./controllers/authController");
const { recordDeposit } = require("./Listeners/deposit");
const { recordLoanEvents } = require("./Listeners/loan");
const { recordPayoutEvents } = require("./Listeners/payment");
const { runAutoPayout } = require("./engine/autoPayCron");

require("dotenv").config();

const app = express();
connectDB();

// Configure CORS with proper preflight support
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
);

// Add a specific handler for OPTIONS requests
app.options("*", cors());

// schedule cron for every 5 seconds
cron.schedule("*/5 * * * * *", async () => {
  await recordDeposit();
  await recordLoanEvents();
  await recordPayoutEvents();
  await runAutoPayout();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(seralizeUser);

bot.launch()
  .then(() => console.log('Telegram bot is running...'))
  .catch((error) => console.error('Failed to launch bot:', error));


app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/loan", loanRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/lending", lendingRouter);
app.use("/api/initialisation", loanInitialisationRouter);
app.use("/api/insurance", insuranceRouter);

app.get("/", async (req, res) => {
  return res.json({ message: "Hello World" });
});

const port = process.env.PORT || 5005;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});