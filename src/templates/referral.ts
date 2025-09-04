
export const newReferralTemplate = (options: {
  fullName: string;
  referralFullName: string;
}) => {
  const {
    fullName,
    referralFullName,
  } = options;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Referral</title>
    <style>
      body {
        font-family: sans-serif;
        background-color: #f2f2f2;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #fff;
        border-radius: 5px;
      }
      h1 {
        color: #007bff;
      }
      p {
        margin-bottom: 20px;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        background-color: #007bff;
        color: #fff;
        text-decoration: none;
        border-radius: 5px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>New Referral</h1>
      <p>Hi ${fullName},</p>
      <p>You have a new referral! ${referralFullName} has signed up using your referral link.</p>
      <p>You can view your referrals and earnings in your dashboard.</p>
      <a href="https://lendbloc.com/dashboard" class="button">Go to Dashboard</a>
    </div>
  </body>
  </html>
  `;
};
