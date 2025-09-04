
export const otpVerificationEmail = (otpCode: string, expirationMinutes: number) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your LendBloc One-Time Password (OTP)</title>
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
            .otp-code-container {
                text-align: center;
                margin: 30px 0;
            }
            .otp-code {
                font-size: 36px;
                font-weight: bold;
                color: #007bff; /* Highlight OTP with brand color */
                letter-spacing: 5px;
                padding: 15px 25px;
                border: 2px dashed #007bff; /* Dashed border for emphasis */
                display: inline-block;
                border-radius: 8px;
                background-color: #e7f3ff; /* Light background for the code */
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
                <h1>LendBloc Security Alert</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>To complete your action on LendBloc, please use the following One-Time Password (OTP):</p>
                <div class="otp-code-container">
                    <span class="otp-code">${otpCode}</span>
                </div>
                <p>This code is essential for your security and will expire in <strong>${expirationMinutes} minutes</strong>. Please enter it promptly to proceed.</p>
                <p>If you did not request this code, please disregard this email. Your account security is our top priority.</p>
                <p>Thank you for choosing LendBloc.</p>
                <p>Best regards,<br>The LendBloc Team</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} LendBloc. All rights reserved.</p>
                <p><a href="[LINK_TO_PRIVACY_POLICY]">Privacy Policy</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
};
