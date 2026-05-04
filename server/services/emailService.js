export async function sendVerificationEmail({ email, name, verificationUrl }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'AI Route Planner <no-reply@ai-route-planner.local>';

  if (!host || !user || !pass) {
    console.log(`[Email Preview] Verification link for ${email}: ${verificationUrl}`);
    return {
      delivered: false,
      preview: true,
      previewUrl: verificationUrl,
    };
  }

  try {
    const mod = await import('nodemailer');
    const nodemailer = mod.default || mod;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your AI Route Planner account',
      text: [
        `Hi ${name || 'there'},`,
        '',
        'Thanks for signing up for AI Route Planner.',
        `Verify your email by opening this link: ${verificationUrl}`,
        '',
        'If you did not create this account, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin-bottom:12px">Verify your email</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Thanks for signing up for AI Route Planner. Confirm your email to activate your account.</p>
          <p>
            <a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600">
              Verify Email
            </a>
          </p>
          <p style="font-size:13px;color:#4b5563">If the button does not work, open this URL:</p>
          <p style="font-size:13px;color:#4b5563">${verificationUrl}</p>
        </div>
      `,
    });

    return {
      delivered: true,
      preview: false,
      previewUrl: null,
    };
  } catch (error) {
    console.error('[Email] Delivery failed:', error.message);
    console.log(`[Email Preview] Verification link for ${email}: ${verificationUrl}`);
    return {
      delivered: false,
      preview: true,
      previewUrl: verificationUrl,
      error: error.message,
    };
  }
}

export default {
  sendVerificationEmail,
};
