const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
const ethers = require("ethers")
const AppError = require("../utils/appError")
const { createPublicClient, http } = require("viem")
const { parseSiweMessage } = require("viem/siwe")
const { baseSepolia } = require("viem/chains")
dotenv.config()

const User = require("../schema/UserSchema")

exports.getNonce = async (req, res, next) => {
  console.log("REQUEST")
  // Generate a more secure nonce for SIWE
  const { generateSiweNonce } = require("viem/siwe")
  let nonce = generateSiweNonce()
  let address = req.query.address
  if (!address) return next(new AppError("Address parameter missing", 403))

  let tempToken = jwt.sign({ nonce, address }, process.env.JWTSECRET, {
    expiresIn: "1h",
  })

  res.status(200).json({
    status: "success",
    nonce,
    token: tempToken,
  })
}

exports.verifyUser = async (req, res, next) => {
  let authHeader = req.headers["authorization"]
  let token = (authHeader && authHeader.split(" ")[1]) || null
  if (token === null)
    return next(new AppError("Invalid Authorization Header", 403))
  if (!req.body.signature)
    return next(new AppError("Signature parameter missing", 403))

  try {
    let decoded = jwt.verify(token, process.env.JWTSECRET)

    let nonce = decoded.nonce
    let address = decoded.address
    console.log("decoded: ", decoded)
    let signature = req.body.signature

    // Check if a SIWE message was provided
    let message = req.body.message

    // If no message is provided or it's not in SIWE format, create one
    if (
      !message ||
      typeof message !== "string" ||
      !message.includes("wants you to sign in with your Ethereum account")
    ) {
      // Create a proper SIWE message
      const { createSiweMessage } = require("viem/siwe")

      message = createSiweMessage({
        domain: req.get("host") || "bitmore.protocol",
        address: address,
        statement: "Sign in with Ethereum to the Bitmore Protocol",
        uri: req.protocol + "://" + req.get("host"),
        version: "1",
        chainId: baseSepolia.id,
        nonce: nonce.toString(),
      })
    }

    console.log("SIWE message: ", message)

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    })

    // Verify the SIWE message
    let valid = await publicClient.verifySiweMessage({
      message: message,
      signature: signature,
    })

    console.log("Verification result: ", valid)

    if (!valid) {
      return next(new AppError("Invalid Signature", 403))
    }

    // Parse the message to get the address
    const siweMessage = parseSiweMessage(message)
    const userAddress = siweMessage.address.toLowerCase()

    let user = await User.findOne({
      user_address: userAddress,
    })

    if (!user) {
      user = await User.create({
        user_address: userAddress,
      })
    }

    let JwtToken = jwt.sign({ id: user._id }, process.env.JWTSECRET, {
      expiresIn: "1d",
    })

    res.status(200).json({
      status: "success",
      token: JwtToken,
      user: user,
    })
  } catch (error) {
    console.error("Authentication error:", error)
    return next(new AppError(error.message || "Authentication failed", 403))
  }
}

exports.seralizeUser = async (req, _res, next) => {
  let authHeader = req.headers["authorization"]
  let token = (authHeader && authHeader.split(" ")[1]) || null
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWTSECRET)

      console.log("decoded: ", decoded)

      const user = await User.findById(decoded.id)
      req.user = user
      next()
    } catch (err) {
      req.user = null
      return next()
    }
  } else {
    req.user = null
    next()
  }
}

exports.isLoggedIn = (req, _res, next) => {
  if (req.user) {
    next()
  } else {
    next(new AppError("UnAuthorized Request", 401))
  }
}