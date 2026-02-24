type VerificationEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  appName: string;
  verificationUrl: string;
  recipientName?: string | null;
};

type WelcomeEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  appName: string;
  recipientName?: string | null;
  signinUrl?: string;
};

export async function sendVerificationEmail(input: VerificationEmailInput) {
  const recipient = input.recipientName?.trim() || "there";
  const subject = `${input.appName}: verify your email`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hi ${escapeHtml(recipient)},</p>
      <p>Thanks for signing up for ${escapeHtml(input.appName)}. Verify your email by clicking the button below.</p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(input.verificationUrl)}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; display: inline-block;">
          Verify email
        </a>
      </p>
      <p>If the button does not work, copy and paste this URL into your browser:</p>
      <p><a href="${escapeHtml(input.verificationUrl)}">${escapeHtml(input.verificationUrl)}</a></p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  const text = [
    `Hi ${recipient},`,
    "",
    `Thanks for signing up for ${input.appName}.`,
    "Verify your email with this link:",
    input.verificationUrl,
    "",
    "This link expires in 24 hours.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const recipient = input.recipientName?.trim() || "there";
  const signinUrl = input.signinUrl || "";
  const subject = `Welcome to ${input.appName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hi ${escapeHtml(recipient)},</p>
      <p>Your account has been approved. Welcome to ${escapeHtml(input.appName)}.</p>
      ${signinUrl
        ? `<p style="margin: 24px 0;">
        <a href="${escapeHtml(signinUrl)}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; display: inline-block;">
          Sign in
        </a>
      </p>`
        : ""}
      <p>Glad to have you here.</p>
    </div>
  `;

  const text = [
    `Hi ${recipient},`,
    "",
    `Your account has been approved. Welcome to ${input.appName}.`,
    signinUrl ? `Sign in: ${signinUrl}` : "",
    "",
    "Glad to have you here.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
