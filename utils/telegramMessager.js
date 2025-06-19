const User = require("../schema/UserSchema");
const dotenv = require('dotenv');
dotenv.config();

const { Telegraf } = require('telegraf');
console.log("TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN);
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// In telegramMessager.js
bot.command('start', (ctx) => {
  const telegramId = ctx.from.id.toString();
  console.log(`User started bot with Telegram ID: ${telegramId}`);
  ctx.reply(`Welcome to BitMor Notify Bot! This is your first step to becoming a full-coiner. You will now recieve notifications on activity happening on your BitMor account.`);
});

async function sendTelegramMessage(userId, message) {
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            console.error(`User with ID ${userId} not found.`);
            return;
        }

        if(!user.telegramId) {
            console.error(`User with ID ${userId} does not have a Telegram ID linked.`);
            return;
        }

        await bot.telegram.sendMessage(Number(user.telegramId), message);
        console.log(`Message sent to user ${userId}: ${message}`);
    } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
    }
}

module.exports = {
    sendTelegramMessage,
    bot
};