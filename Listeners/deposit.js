const { contract, provider } = require("../constants");
const Lend = require("../schema/LendingSchema"); // Import the Lend model
const User = require("../schema/UserSchema"); // Import the User model
const ethers = require("ethers");
const { sendTelegramMessage } = require("../utils/telegramMessager");

/**
 * Listens for Deposit events and records them to the database
 * Focused on data directly available from the LendingPool contract
 */
const recordDeposit = async () => {
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(
      `Checking for deposit events from block ${blockNumber - 100} to ${blockNumber}`,
    );

    // Listen for deposit events
    const depositEvents = await contract.queryFilter(
      contract.filters.Deposit(),
      blockNumber - 100,
    );

    console.log(`Found ${depositEvents.length} deposit events`);

    // Process each deposit event
    for (const event of depositEvents) {
      // Extract data from the event based on your contract
      // event Deposit(address indexed lender, uint256 amount, bool reinvest);
      const lender = event.args.lender;
      const amount = ethers.formatUnits(event.args.amount, 6); // 6 decimals for USDC
      const reinvest = event.args.reinvest

      console.log(
        `Processing deposit from ${lender} of amount ${amount.toString()}`,
      );

      // Find the user by their blockchain address
      const user = await User.findOne({ user_address: lender.toLowerCase() });

      if (!user) {
        console.error(`User with address ${lender} not found`);
        continue;
      }

      // Get the current network/chain information
      const network = await provider.getNetwork();
      const chain_id = network.chainId;

      // Get transaction block for timestamp
      const txBlock = await provider.getBlock(event.blockNumber);
      const timestamp = txBlock
        ? txBlock.timestamp
        : Math.floor(Date.now() / 1000);

      // Create simplified lending record based on contract's structure
      const alreadyExists = await Lend.findOne({ txHash: event.transactionHash });
      if(alreadyExists) {
        console.log(`Lending record already exists for transaction ${event.transactionHash}`);
        return;
      }
      const lending = await Lend.create({
        user_id: user._id,
        user_address: lender,
        lending_amount_approved: amount.toString(),
        available_amount: amount.toString(), // Same as deposit amount initially
        openedOn: new Date(timestamp * 1000),
        reinvest,
        txHash: event.transactionHash,
      });

      // Update user record
      user.lendings.push(lending._id);

      // Default asset to USDC as used in contract
      const asset = "USDC";

      console.log(user.totalCapitalLent, "User total capital lent before update");

      // Update total capital lent
      if (!user.totalCapitalLent) {
        user.totalCapitalLent = {
          chain_id: chain_id,
          asset,
          amount: amount,
        };
      } else {
        // If user already has capital lent, update it
        const currentAmount = Number(user.totalCapitalLent.amount) || 0;
        const newAmount = currentAmount + Number(amount);

        user.totalCapitalLent.amount = Number(newAmount);
      }

      await user.save();

      console.log(
        `Successfully added lending with ID ${lending._id} for user ${user._id}`,
      );

      // Trigger TG Bot notification
      await sendTelegramMessage(user._id, "Your deposit was recorded successfully, and you will receive notifications on your deposit activities here. You can also check your lending details on the BitMor app.");
      lending.notify = true; // Set notify to true for the lending record
      await lending.save();
      
    }
  } catch (error) {
    console.error("Error processing deposit events:", error);
  }
};

module.exports = { recordDeposit };
