const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const ethers = require("ethers");
const AppError = require("../utils/appError");
const { SiweMessage } = require("siwe"); // Sign-In with Ethereum library
dotenv.config();

const User = require("../schema/UserSchema");

/**
 * Generate a Sign-In with Ethereum message (EIP-4361)
 */
exports.getNonce = async (req, res, next) => {
  console.log("REQUEST");
  const nonce = Math.floor(Math.random() * 1000000).toString(); // Random nonce
  const address = req.query.address;
  if (!address) return next(new AppError("Address parameter missing", 403));

  const domain = req.get("host");
  const origin = req.get("origin");
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

  // Create SIWE message parameters
  const siweParams = {
    domain,
    address,
    statement: "Sign in with Ethereum to authenticate with our service.",
    uri: origin,
    version: "1",
    chainId: 84532, // Base Sepolia Chain ID
    nonce,
    issuedAt,
    expirationTime
  };

  // Create the message object
  const message = new SiweMessage(siweParams);
  
  // Convert to EIP-4361 standard format string
  const messageToSign = message.prepareMessage();

  // Store the message data in a JWT for verification later
  const tempToken = jwt.sign({ 
    messageData: siweParams,
    messageToSign 
  }, process.env.JWTSECRET, {
    expiresIn: "1h",
  });
  
  res.status(200).json({
    status: "success",
    message: messageToSign,
    nonce,
    token: tempToken,
  });
};

/**
 * Verify the signed EIP-4361 message
 */
exports.verifyUser = async (req, res, next) => {
  let authHeader = req.headers["authorization"];
  let token = (authHeader && authHeader.split(" ")[1]) || null;
  if (token === null) return next(new AppError("Invalid Authorization Header", 403));
  if (!req.query.signature)
    return next(new AppError("Signature parameter missing", 403));

  const decoded = jwt.verify(token, process.env.JWTSECRET);
  console.log("decoded: ", decoded);

  const { messageData, messageToSign } = decoded;
  const signature = req.query.signature;
  const address = messageData.address;

  try {
    // Create a new SIWE message from the stored parameters
    const message = new SiweMessage(messageData);
    
    // Verify the signature using EIP-4361 standards
    const { success, data, error } = await message.verify({
      signature,
      time: messageData.issuedAt,
    });

    if (!success) {
      console.error("SIWE verification error:", error);
      return next(new AppError("Invalid Signature", 403));
    }

    // Verify the recovered address matches the claimed address
    if (data.address.toLowerCase() !== address.toLowerCase()) {
      return next(new AppError("Address mismatch", 403));
    }

    // Find or create user
    let user = await User.findOne({ user_address: address.toLowerCase() });
    if (!user) {
      user = await User.create({ user_address: address.toLowerCase() });
    }

    // Generate authentication token
    const JwtToken = jwt.sign({ id: user._id }, process.env.JWTSECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      status: "success",
      token: JwtToken,
      user: user,
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return next(new AppError("Signature verification failed: " + error.message, 403));
  }
};

/**
 * Deserialize user from JWT token
 */
exports.seralizeUser = async (req, res, next) => {
  let authHeader = req.headers["authorization"];
  let token = (authHeader && authHeader.split(" ")[1]) || null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWTSECRET);
      console.log("decoded: ", decoded);
      const user = await User.findById(decoded.id);
      req.user = user;
      next();
    } catch (err) {
      req.user = null;
      return next();
    }
  } else {
    req.user = null;
    next();
  }
};

/**
 * Middleware to check if user is logged in
 */
exports.isLoggedIn = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    next(new AppError("UnAuthorized Request", 401));
  }
};