const axios = require("axios");
const qs = require("querystring");
const Waitlist = require("../schema/waitlistSchema");
const dotenv = require("dotenv");
dotenv.config();

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const redirect_uri = process.env.GOOGLE_REDIRECT_URI;

exports.googleAuthRedirect = (req, res) => {
  const query = qs.stringify({
    client_id,
    redirect_uri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  const authURL = `${GOOGLE_AUTH_BASE_URL}?${query}`;
  res.redirect(authURL);
};

exports.googleAuthCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided");

  try {
    // 1. Exchange code for tokens
    const { data: tokenData } = await axios.post(
      GOOGLE_TOKEN_URL,
      qs.stringify({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const access_token = tokenData.access_token;

    // 2. Fetch user profile
    const { data: userInfo } = await axios.get(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // 3. You can now create a user or session
    console.log("Google User Info:", userInfo);

 try {
  const existingUser = await Waitlist.findOne({ email: userInfo.email });
  if (!existingUser) {
    const newWaitlistEntry = await Waitlist.create({
      email: userInfo.email,
      name: userInfo.name,
    });
    console.log("New waitlist entry created:", newWaitlistEntry);
  } else {
    console.log("User already exists in waitlist:", existingUser);
  }

  // ✅ Success redirect
  res.redirect(`https://bitmore.vercel.app/?waitlist_success=true`);
} catch (err) {
  console.error("Error saving user to waitlist:", err);

  // ❌ Failure redirect
  res.redirect(`https://bitmore.vercel.app/?waitlist_success=false`);
}
    } catch (err) {
    console.error("OAuth Error:", err.response?.data || err.message);
    res.status(500).send("Failed to authenticate with Google");
  }
};

  exports.addEmailToWaitlist = async (req, res) => {    
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const existingUser = await Waitlist.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "Email already exists in waitlist" });
      }

      const waitlistData = { email };
      const newWaitlistEntry = await Waitlist.create(waitlistData);
      res.status(201).json({ message: "Email added to waitlist", user: newWaitlistEntry });
    } catch (error) {
      console.error("Error adding email to waitlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
