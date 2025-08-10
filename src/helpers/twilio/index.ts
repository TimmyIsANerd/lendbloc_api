import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Sends an SMS message to the specified phone number via Twilio.
 *
 * @param phoneNumber The phone number to which the SMS will be sent.
 * @param message The message to be sent.
 * @returns A promise that resolves to an object indicating the success of the operation.
 * @throws If there is an issue with sending the SMS via Twilio.
 */
export const sendSms = async (phoneNumber: string, message: string) => {
    await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
    });

    return { message: 'SMS sent successfully.' };
};