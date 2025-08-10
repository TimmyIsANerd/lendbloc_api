import { MailtrapClient } from 'mailtrap';

const client = new MailtrapClient({
    token: process.env.MAILTRAP_API_KEY!,
})


/**
 * Sends an email using Mailtrap's API.
 *
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} body - The HTML body of the email.
 *
 * @returns {Promise<void>} A promise that resolves when the email has been sent
 * successfully, or rejects if the email could not be sent after a maximum of
 * 3 retries with a 1 second delay between each retry.
 */
export const sendEmail = async (to: string, subject: string, body: string) => {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            await client.send({
                from: {
                    name: "LendBloc",
                    email: process.env.MAILTRAP_FROM_EMAIL!
                },
                to: [{ email: to }],
                subject,
                html: body
            })
            break;
        } catch (error) {
            console.error('Error sending email:', error);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (retries === maxRetries) {
        console.error('Failed to send email after', maxRetries, 'retries');
    }
}