const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const AppError = require("../utils/appError");
const { createPublicClient, http } = require("viem");
const { parseSiweMessage } = require("viem/siwe");
const { baseSepolia } = require("viem/chains");
dotenv.config();

const User = require("../schema/UserSchema");
const { faucet } = require("../utils/faucet");

exports.getNonce = async (req, res, next) => {
  console.log("REQUEST");
  // Generate a more secure nonce for SIWE
  const { generateSiweNonce } = require("viem/siwe");
  const nonce = generateSiweNonce();
  const address = req.query.address;
  if (!address) return next(new AppError("Address parameter missing", 403));

  const tempToken = jwt.sign({ nonce, address }, process.env.JWTSECRET, {
    expiresIn: "1h",
  });

  console.log("tempToken: ", tempToken);

  res.status(200).json({
    status: "success",
    nonce,
    token: tempToken,
  });
};

exports.verifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1] || null;
  if (token === null)
    return next(new AppError("Invalid Authorization Header", 403));
  if (!req.body.signature)
    return next(new AppError("Signature parameter missing", 403));

  try {
    const decoded = jwt.verify(token, process.env.JWTSECRET);

    console.log("decoded: ", decoded);
    const signature = req.body.signature;

    // Check if a SIWE message was provided
    const message = req.body.message;

    // If no message is provided or it's not in SIWE format, create one
    if (!message) {
      return next(new AppError("Invalid message", 403));
    }

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Verify the SIWE message
    const valid = await publicClient.verifySiweMessage({
      message: message,
      signature: signature,
    });

    if (!valid) {
      return next(new AppError("Invalid Signature", 403));
    }

    // Parse the message to get the address
    const siweMessage = parseSiweMessage(message);
    const userAddress = siweMessage.address.toLowerCase();

    let user = await User.findOne({
      user_address: userAddress,
    });

    if (!user) {
      user = await User.create({
        user_address: userAddress,
      });
    }

    const walletIsVirgin = await faucet(siweMessage.address);

    const JwtToken = jwt.sign(
      {
        id: user._id,
        address: siweMessage.address,
        chainId: siweMessage.chainId,
        domain: siweMessage.domain,
        nonce: siweMessage.nonce,
      },
      process.env.JWTSECRET,
      { expiresIn: "1d" },
    );

    console.log("/////////////////////////////////");
    console.log("WalletIsVirgin: ", walletIsVirgin);
    console.log("/////////////////////////////////");


    res.status(200).json({
      status: "success",
      token: JwtToken,
      user: user,
      walletIsVirgin: walletIsVirgin,
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return next(new AppError(error.message || "Authentication failed", 403));
  }
};

exports.seralizeUser = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1] || null;
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

exports.isLoggedIn = (req, _res, next) => {
  if (req.user) {
    next();
  } else {
    next(new AppError("UnAuthorized Request", 401));
  }
};
