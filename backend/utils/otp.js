const crypto = require("crypto");
const bcrypt = require("bcryptjs");

function generateOtp(length = 6) {
  const max = Math.pow(10, length);
  const otp = crypto.randomInt(0, max).toString().padStart(length, "0");
  return otp;
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOtp(otp, hash) {
  return bcrypt.compare(otp, hash);
}

module.exports = { generateOtp, hashOtp, verifyOtp };
