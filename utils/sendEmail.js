const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const templates = {
  welcome: (name) => ({
    subject: "Welcome to BitMor – You're On the Waitlist 🎉",
    html: `
      <p>Hi ${name || "there"},</p>
      <p>Thanks for joining the <strong>BitMor</strong> waitlist – we're thrilled to have you on board! 🚀</p>
      <p>You're now in line to be among the first to experience our next-gen crypto products. We'll keep you updated on major releases, early access perks, and community events.</p>
      <p>If you have any questions, just reply to this email – we'd love to hear from you.</p>
      <br>
      <p>– The BitMor Team</p>
      <a href="https://bitmor.vercel.app">https://bitmor.vercel.app</a>
    `,
  }),

  deposit: ({ name, amount }) => ({
    subject: "Deposit Successful – BitMor",
    html: `
      <p>Hi ${name || "there"},</p>
      <p>We’ve received your deposit of <strong>${amount} USDC</strong> into the BitMor protocol. 💸</p>
      <p>You're helping power the future of decentralized finance</p>
      <p>You can check your dashboard for more details.</p>
      <br>
      <p>– BitMor Team</p>
    `,
  }),

  loan: ({ name, loanId, amount, asset }) => ({
    subject: "Your Loan is Live – BitMor",
    html: `
      <p>Hi ${name || "there"},</p>
      <p>Your loan <strong>#${loanId}</strong> of <strong>${amount} ${asset}</strong> has been successfully issued. 📝</p>
      <p>Make sure to stay on top of your repayment schedule to avoid penalties.</p>
      <br>
      <p>– BitMor Team</p>
    `,
  }),

  payment: ({ name, amount, loanId }) => ({
    subject: "Payment Received – BitMor",
    html: `
      <p>Hi ${name || "there"},</p>
      <p>We’ve received your payment of <strong>${amount} USDC</strong> towards loan <strong>#${loanId}</strong>.</p>
      <p>You're one step closer to paying it off!</p>
      <br>
      <p>– BitMor Team</p>
    `,
  }),

  reminder: ({ name, dueDate, loanId }) => ({
    subject: "Friendly Payment Reminder – BitMor",
    html: `
      <p>Hi ${name || "there"},</p>
      <p>This is a gentle reminder that your next payment for loan <strong>#${loanId}</strong> is due on <strong>${dueDate}</strong>.</p>
      <p>Please make sure you pay on time to avoid late fees.</p>
      <br>
      <p>– BitMor Team</p>
    `,
  }),
};

exports.sendEmail = async (type, toEmail, data = {}) => {
  if (!templates[type]) throw new Error(`Unknown email type: ${type}`);

  const { subject, html } = templates[type](data);

  const mailOptions = {
    from: `"BitMor" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};
