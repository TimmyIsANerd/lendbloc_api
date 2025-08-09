
export const accountCreatedEmail = (firstName: string, linkToDashboard: string) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to LendBloc!</title>
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
                <h1>Welcome to LendBloc!</h1>
            </div>
            <div class="content">
                <p>Hi ${firstName},</p>
                <p>Great news! Your LendBloc account has been successfully created. You're now officially part of a community that's redefining how you interact with your crypto assets.</p>
                <p>We're excited for you to explore all the powerful features designed to help you grow your wealth and manage your digital assets with ease. From earning passive income through our savings accounts to securing flexible loans, LendBloc is built for your financial freedom.</p>
                <p>Ready to get started?</p>
                <div class="button-container">
                    <a href="${linkToDashboard}" class="button">Access Your Dashboard Now</a>
                </div>
                <p>If you have any questions or need assistance, our dedicated support team is always here to help you every step of the way.</p>
                <p>Welcome aboard!</p>
                <p>Best regards,<br>The LendBloc Team</p>
            </div>
            <div class="footer">
                <p>You received this email because you created an account with LendBloc.</p>
                <p>&copy; ${new Date().getFullYear()} LendBloc. All rights reserved.</p>
                <p><a href="[LINK_TO_UNSUBSCRIBE]">Unsubscribe</a> | <a href="[LINK_TO_PRIVACY_POLICY]">Privacy Policy</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
};
