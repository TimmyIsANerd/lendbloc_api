import twilio from 'twilio';
import { generateOtp } from "../otp/index"

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const sendOtp = async (phoneNumber: string) => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes
    const otpCode = generateOtp();

    await client.messages.create({
        body: `Your LendBloc OTP code is: ${otpCode}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
    });

    return { message: 'An OTP has been sent to your phone.' };
};