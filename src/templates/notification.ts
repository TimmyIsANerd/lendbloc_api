
export const emailNotificationTemplate = (options: {
  fullName: string;
  message: string;
}) => {
  const {
    fullName,
    message,
  } = options;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification</title>
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
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Notification</h1>
      <p>Hi ${fullName},</p>
      <p>${message}</p>
    </div>
  </body>
  </html>
  `;
};

export const smsNotificationTemplate = (options: {
  message: string;
}) => {
  const {
    message,
  } = options;

  return `LendBloc Notification: ${message}`;
};
