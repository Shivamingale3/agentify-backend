const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for HTML element content and quoted attribute values. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

export const emailVerificationTemplate = (email: string, link: string): string => {
  const safeEmail = escapeHtml(email);
  const safeLink = escapeHtml(link);
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body>
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">

        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #007bff;">
            <h1 style="color: #007bff; margin: 0;">Agentify</h1>
        </div>

        <div style="padding: 20px 0;">
            <h2 style="color: #333;">Verify Your Email Address</h2>

            <p>Hi <strong>${safeEmail}</strong>,</p>

            <p>Thank you for joining Agentify! To complete your registration, please verify your email address by clicking the link below:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${safeLink}"
                   style="background-color: #007bff; color: white; padding: 12px 25px;
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block;">
                    Verify Email
                </a>
            </div>

            <p>This verification link will expire in <strong>1 hour</strong>.</p>

            <p>If you did not create this account, please ignore this email.</p>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #777;">
            <p>&copy; ${new Date().getFullYear()} Agentify. All rights reserved.</p>
            <p>If you have any questions, please contact our support team at agentify@shivamingale.com</p>
        </div>

    </div>
</body>
</html>`;
};
