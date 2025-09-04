import axios from 'axios';

/**
 * Sends an SMS message to the specified phone number via Twilio.
 *
 * @param phoneNumber The phone number to which the SMS will be sent.
 * @param message The message to be sent.
 * @returns A promise that resolves to an object indicating the success of the operation.
 * @throws If there is an issue with sending the SMS via Twilio.
 */
export const sendSms = async (phoneNumber: string, message: string) => {
    const maxRetries = 3;
    let retries = 0;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;

    const data = new URLSearchParams();
    data.append('To', phoneNumber);
    data.append('From', process.env.TWILIO_PHONE_NUMBER!);
    data.append('Body', message);

    while (retries < maxRetries) {
        try {
            await axios.post(url, data, {
                auth: {
                    username: process.env.TWILIO_ACCOUNT_SID!,
                    password: process.env.TWILIO_AUTH_TOKEN!
                }
            });

            console.log(`SMS sent successfully to: ${phoneNumber}`);
            return { message: 'SMS sent successfully.' };
        } catch (error: any) {
            console.error('Error sending SMS:', error.response.data);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Delay for 5 seconds before retrying
        }
    }

    if (retries === maxRetries) {
        console.error('Failed to send SMS after', maxRetries, 'retries');
        throw new Error('Failed to send SMS');
    }
};