export const adminInviteEmail = (inviterName: string, token: string) => {
  const year = new Date().getFullYear();
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LendBloc Admin Invitation</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background:#f6f6f6; color:#333; margin:0; padding:0; }
      .container { max-width:600px; margin:20px auto; background:#fff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden; }
      .header { background:#007bff; color:#fff; padding:16px 24px; }
      .content { padding:24px; }
      .token { font-weight:bold; color:#007bff; word-break:break-all; }
      .footer { font-size:12px; color:#777; border-top:1px solid #eee; padding:12px 24px; text-align:center; }
      .btn { display:inline-block; background:#007bff; color:#fff !important; padding:10px 16px; border-radius:6px; text-decoration:none; }
      .muted { color:#666; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>LendBloc Admin Invitation</h2>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p><strong>${inviterName}</strong> has invited you to join the LendBloc admin panel.</p>
        <p class="muted">Use the invitation token below to complete your registration:</p>
        <p class="token">${token}</p>
        <p>If your application uses a web flow, paste this token in the invitation acceptance screen. If you received this message in error, you can ignore this email.</p>
        <p>Welcome aboard,<br/>The LendBloc Team</p>
      </div>
      <div class="footer">&copy; ${year} LendBloc. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
};
