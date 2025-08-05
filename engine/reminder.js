const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");
const { sendEmail } = require("../utils/sendEmail");
const { sendTelegramMessage } = require("../utils/telegramMessager");
const dayjs = require("dayjs");

const runReminderJob = async () => {
  try {
    const today = dayjs().startOf("day");

    const loans = await Loan.find({
      is_active: true,
      is_repaid: false,
    }).populate("user_id");

    for (const loan of loans) {
      const user = loan.user_id;
      if (!user) continue;

      const reminderBeforeDays = loan.reminderDaysBefore || 3;
      const reminderDate = dayjs(loan.next_payment_date).subtract(reminderBeforeDays, "day");

      if (today.isSame(reminderDate, "day")) {
        const { email, name, telegramId } = user;

        // Send Email
        if (email) {
          await sendEmail("reminder", email, {
            name,
            dueDate: loan.next_payment_date.toDateString(),
            loanId: loan.loan_id,
          });
        }

        // Send Telegram
        if (telegramId) {
          await sendTelegramMessage(
            user._id,
            `⏰ Reminder: Your next BitMor loan payment (Loan ID: ${loan.loan_id}) is due on ${dayjs(loan.next_payment_date).format("DD MMM YYYY")}. Don’t forget to pay on time!`
          );
        }
      }
    }

    console.log("✅ Reminder job completed.");
  } catch (err) {
    console.error("❌ Error in reminder cron:", err);
  }
};

module.exports = { runReminderJob };
