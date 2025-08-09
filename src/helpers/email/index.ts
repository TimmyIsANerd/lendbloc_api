
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to: string, subject: string, templateName: string, data: Record<string, string>) => {
    const templatePath = path.join(__dirname, `../../templates/${templateName}.html`);
    let html = fs.readFileSync(templatePath, 'utf-8');

    for (const key in data) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key]);
    }

    try {
        await resend.emails.send({
            from: 'LendBloc <onboarding@resend.dev>',
            to,
            subject,
            html,
        });
    } catch (error) {
        console.error('Error sending email:', error);
    }
};
