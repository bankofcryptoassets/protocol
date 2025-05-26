const Loan = require("../schema/LoaningSchema"); // Update path if needed
const { contract } = require("../constants");
const ethers = require("ethers");

async function runAutoPayout() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const loansDue = await Loan.find({
      is_active: true,
      is_liquidated: false,
      is_repaid: false,
      next_payment_date: { $lte: today },
    });

    console.log(`🧾 Found ${loansDue.length} loans due for payment today.`);

    for (const loan of loansDue) {
      const borrower = loan.user_address;
      const openedOn = Math.floor(new Date(loan.openedOn).getTime() / 1000);

      // 4. Generate loanId as in Solidity
      const loanId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256"],
          [borrower, openedOn],
        ),
      );

      const usdcAmount = ethers.parseUnits(
        loan.monthly_payable_amount.toString(),
        6, // USDC decimals
      );

      try {
        const tx = await contract.payouts(loanId, usdcAmount);
        console.log(`✅ Called payouts for ${loanId}, tx: ${tx.hash}`);
        await tx.wait();

        // Optional: update DB dates
        loan.last_payment_date = new Date();
        loan.next_payment_date = new Date(
          loan.next_payment_date.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        await loan.save();
      } catch (err) {
        console.error(`❌ Failed to payout for loan ${loanId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("🔴 Error in cron job:", err.message);
  }
}

module.exports = {
  runAutoPayout,
};
