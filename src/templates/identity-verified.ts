
export const identityVerifiedEmail = (firstName: string) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Identity Verified - Welcome to Full Access!</title>
        <style>
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 1px solid #007bff;
            }
            .header h1 {
                color: #007bff; /* LendBloc brand color */
                margin: 0;
                font-size: 28px;
            }
            .content {
                padding: 20px 0;
                text-align: left; /* Align content to left for better readability */
            }
            .content p {
                margin-bottom: 15px;
            }
            .success-icon {
                text-align: center;
                font-size: 48px;
                color: #28a745; /* Green for success */
                margin-bottom: 20px;
            }
            .button-container {
                text-align: center;
                padding: 20px 0;
            }
            .button {
                display: inline-block;
                background-color: #007bff; /* LendBloc brand color */
                color: #ffffff;
                padding: 12px 25px;
                border-radius: 5px;
                text-decoration: none;
                font-weight: bold;
                transition: background-color 0.3s ease;
            }
            .button:hover {
                background-color: #0056b3; /* Darker shade on hover */
            }
            .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #eeeeee;
                font-size: 12px;
                color: #777777;
            }
            .footer a {
                color: #007bff;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>LendBloc</h1>
            </div>
            <div class="content">
                <div class="success-icon">&#10004;</div>
                <p>Hi ${firstName},</p>
                <p>Fantastic news! Your identity verification with LendBloc has been successfully completed. This means you now have full access to all the powerful features our platform offers.</p>
                <p>You're all set to securely manage your crypto, explore lending opportunities, earn passive income through savings, and much more. We're committed to providing you with a seamless and secure experience.</p>
                <div class="button-container">
                    <a href="[LINK_TO_DASHBOARD]" class="button">Go to Your Dashboard</a>
                </div>
                <p>Should you have any questions as you begin, our support team is always ready to assist.</p>
                <p>Happy transacting!</p>
                <p>Best regards,<br>The LendBloc Team</p>
            </div>
            <div class="footer">
                <p>You received this email because your identity was verified on LendBloc.</p>
                <p>&copy; ${new Date().getFullYear()} LendBloc. All rights reserved.</p>
                <p><a href="[LINK_TO_UNSUBSCRIBE]">Unsubscribe</a> | <a href="[LINK_TO_PRIVACY_POLICY]">Privacy Policy</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
};
