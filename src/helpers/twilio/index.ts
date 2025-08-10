import twilio from 'twilio';
import { generateOtp } from "../otp/index"

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Sends a One-Time Password (OTP) to the specified phone number via Twilio.
 * The OTP is valid for 10 minutes.
 *
 * @param phoneNumber The phone number to which the OTP will be sent.
 * @returns A promise that resolves to an object indicating the success of the operation.
 * @throws If there is an issue with sending the SMS via Twilio.
 */
export const sendOtp = async (phoneNumber: string) => {
    const otpCode = generateOtp();

    await client.messages.create({
        body: `Your LendBloc OTP code is: ${otpCode}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
    });

    return { message: 'An OTP has been sent to your phone.' };
};