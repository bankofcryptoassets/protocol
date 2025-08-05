const mongoose = require("mongoose");

const WaitlistSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name : { type: String },
    accessToken: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    earlyAdopter: { type: Boolean, default: true },
});

const Waitlist = mongoose.model("Waitlist", WaitlistSchema);

module.exports = Waitlist;
