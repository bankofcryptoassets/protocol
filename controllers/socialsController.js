// Usage : /?type=loan&amount=0.02&loanId=BTC420&platform=twitter


exports.socialsShare = (req,res) => {
  const { type, amount, loanId, platform } = req.query;

  if (!type || !amount || !platform) {
    return res.status(400).json({ error: "Missing required parameters (type, amount, platform)" });
  }

  let message;
  if (type === "deposit") {
    message = `Just deposited ${amount} USDC into @bitmor_btc 💸\n\nStacking up for the next cycle. #BitMor #DeFi`;
  } else if (type === "loan") {
    message = `Just took a loan of ${amount} BTC using @bitmor_btc ⚡️\n\nNo banks. Just crypto. Real ownership. #BitMor #Bitcoin${loanId ? ` #Loan${loanId}` : ""}`;
  } else {
    return res.status(400).json({ error: "Invalid type" });
  }

  let redirectURL;

  if (platform === "twitter") {
    redirectURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
  } else if (platform === "farcaster") {
    redirectURL = `https://warpcast.com/~/compose?text=${encodeURIComponent(message)}`;
  } else {
    return res.status(400).json({ error: "Unsupported platform" });
  }

  return res.redirect(redirectURL);
}