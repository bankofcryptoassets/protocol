const { contract, provider } = require("../constants");
const Lend = require("../schema/LendingSchema"); // Import the Lend model
const User = require("../schema/UserSchema"); // Import the User model

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
      // event Deposit(address indexed lender, uint256 amount);
      const lender = event.args.lender;
      const amount = event.args.amount;

      console.log(
        `Processing deposit from ${lender} of amount ${amount.toString()}`,
      );

      // Find the user by their blockchain address
      const user = await User.findOne({ user_address: lender });

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
      const lending = await Lend.create({
        user_id: user._id,
        user_address: lender,
        lending_amount_approved: amount.toString(),
        available_amount: amount.toString(), // Same as deposit amount initially
        openedOn: new Date(timestamp * 1000),
        transaction_hash: event.transactionHash,
        chain_id,
      });

      await lending.save();

      // Update user record
      user.lendings.push(lending._id);

      // Default asset to USDC as used in contract
      const asset = "USDC";

      // Update total capital lent
      if (!user.totalCapitalLent) {
        user.totalCapitalLent = {
          chain_id,
          asset,
          amount: amount.toString(),
        };
      } else {
        // If user already has capital lent, update it
        const currentAmount = user.totalCapitalLent.amount || "0";
        const newAmount = (
          BigInt(currentAmount) + BigInt(amount.toString())
        ).toString();

        user.totalCapitalLent.amount = newAmount;
      }

      await user.save();

      console.log(
        `Successfully added lending with ID ${lending._id} for user ${user._id}`,
      );
    }
  } catch (error) {
    console.error("Error processing deposit events:", error);
  }
};

module.exports = { recordDeposit };
