const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = async () => {
  try {
    console.log(process.env.MONGO_TEST_URI);
    mongoose.set("debug", true);
    await mongoose.connect(process.env.MONGO_TEST_URI, {});
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = { connectDB };
