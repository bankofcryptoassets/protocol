const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const ethers = require("ethers");
const AppError = require("../utils/appError");
dotenv.config();

const User = require("../schema/UserSchema");

exports.getNonce = async (req, res, next) => {
  console.log("REQUEST");
  let nonce = Date.now();
  let address = req.query.address;
  if (!address) return next(new AppError("Address parameter missing", 403));

  let tempToken = jwt.sign({ nonce, address }, process.env.JWTSECRET, {
    expiresIn: "1h",
  });
  let message = nonce;
  res.status(200).json({
    status: "success",
    message,
    nonce,
    token: tempToken,
  });
};

exports.verifyUser = async (req, res, next) => {

  let authHeader = req.headers["authorization"];
  let token = (authHeader && authHeader.split(" ")[1]) || null;
  if (token === null) next(new AppError("Invalid Authorization Header", 403));
  if (!req.query.signature)
    next(new AppError("Signature parameter missing", 403));

  let decoded = jwt.verify(token, process.env.JWTSECRET);

  let nonce = decoded.nonce;
  let address = decoded.address;
  console.log("decoded: ", decoded);
  let message = nonce.toString();
  let signature = req.query.signature;

  let recoveredAddress = ethers.verifyMessage(message, signature);
  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    next(new AppError("Invalid Signature", 403));
  }

  let user = await User.findOne({ user_address: address.toLowerCase() });
  if (!user) {
    user = await User.create({ user_address: address.toLowerCase() });
  }

  let JwtToken = jwt.sign({ id: user._id }, process.env.JWTSECRET, {
    expiresIn: "1d",
  });

  res.status(200).json({
    status: "success",
    token: JwtToken,
    user: user,
  });
};

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

exports.isLoggedIn = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    next(new AppError("UnAuthorized Request", 401));
  }
};
