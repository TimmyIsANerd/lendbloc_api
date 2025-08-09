import { MailtrapClient } from 'mailtrap';

const client = new MailtrapClient({
    token: process.env.MAILTRAP_API_KEY!,
})


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