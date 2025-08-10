/**
 * Generates a random One-Time Password (OTP) of a specified length.
 *
 * @param {number} length - The desired length of the OTP. Defaults to 6.
 * @returns {string} The generated OTP as a string.
 */
export const generateOtp = (length: number = 6): string => {
  const chars = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += chars[Math.floor(Math.random() * chars.length)];
  }
  return otp;
};
