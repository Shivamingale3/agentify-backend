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
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email address</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; color: #0a0a0a; font-family: 'Oxanium', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; width: 100%;">
    <tr>
      <td align="center" style="padding: 48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e5e5e7; border-radius: 0;">

          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #e5e5e7;">
              <span style="font-size: 18px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #0a0a0a; display: inline-block;">
                Agentify
              </span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 40px 32px;">
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b70; margin-bottom: 12px;">
                Account Verification
              </div>

              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; line-height: 1.3; color: #0a0a0a; letter-spacing: -0.01em;">
                Verify your email address
              </h1>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #0a0a0a; line-height: 1.6;">
                Hi <strong style="color: #0a0a0a;">${safeEmail}</strong>,
              </p>

              <p style="margin: 0 0 28px 0; font-size: 15px; color: #6b6b70; line-height: 1.6;">
                Thank you for joining Agentify. Please confirm your email address to complete your registration and activate your account.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" style="border-radius: 0; background-color: #000000;">
                    <a href="${safeLink}"
                       target="_blank"
                       style="display: inline-block; padding: 14px 28px; background-color: #000000; color: #ffffff; font-family: 'Oxanium', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; text-decoration: none; border-radius: 0; border: 1px solid #000000;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 28px 0 0 0; font-size: 13px; color: #6b6b70; line-height: 1.6;">
                This link will expire in 1 hour. If you did not create an account with Agentify, you can safely ignore this email.
              </p>

              <!-- Fallback Plain Link -->
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f2;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b6b70;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; word-break: break-all;">
                  <a href="${safeLink}" style="color: #0a0a0a; text-decoration: underline;">
                    ${safeLink}
                  </a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f6f6f7; border-top: 1px solid #e5e5e7;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b6b70;">
                &copy; ${currentYear} Agentify. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b6b70;">
                Need help? Contact our support team at <a href="mailto:agentify@shivamingale.com" style="color: #0a0a0a; text-decoration: underline;">agentify@shivamingale.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
