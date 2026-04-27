import { marked } from "marked";

type BroadcastEmailRecipient = {
  email: string;
  name?: string | null;
};

type BroadcastEmailInput = {
  apiKey: string;
  from: string;
  appName: string;
  subject: string;
  markdownBody: string;
  recipients: BroadcastEmailRecipient[];
};

type BroadcastEmailResult = {
  attempted: number;
  delivered: number;
  failed: number;
  failures: { email: string; error: string }[];
};

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

type PendingApprovalEmailInput = {
  apiKey: string;
  from: string;
  to: string[];
  appName: string;
  pendingUserEmail: string;
  pendingUserName?: string | null;
  adminUrl?: string;
};

type PasswordResetEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  appName: string;
  resetUrl: string;
  recipientName?: string | null;
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

export async function sendPendingApprovalEmail(input: PendingApprovalEmailInput) {
  const pendingName = input.pendingUserName?.trim() || "Unknown";
  const subject = `${input.appName}: new account pending approval`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>A new account is pending approval.</p>
      <p><strong>Name:</strong> ${escapeHtml(pendingName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(input.pendingUserEmail)}</p>
      ${input.adminUrl
        ? `<p style="margin: 24px 0;">
        <a href="${escapeHtml(input.adminUrl)}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; display: inline-block;">
          Open admin console
        </a>
      </p>`
        : ""}
    </div>
  `;

  const text = [
    "A new account is pending approval.",
    `Name: ${pendingName}`,
    `Email: ${input.pendingUserEmail}`,
    input.adminUrl ? `Admin console: ${input.adminUrl}` : "",
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
      to: input.to,
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

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const recipient = input.recipientName?.trim() || "there";
  const subject = `${input.appName}: reset your password`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hi ${escapeHtml(recipient)},</p>
      <p>We received a request to reset your ${escapeHtml(input.appName)} password.</p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(input.resetUrl)}" style="background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; display: inline-block;">
          Reset password
        </a>
      </p>
      <p>If you didn't request this, you can ignore this email.</p>
      <p>This link expires in 1 hour.</p>
    </div>
  `;

  const text = [
    `Hi ${recipient},`,
    "",
    `We received a request to reset your ${input.appName} password.`,
    "Reset your password with this link:",
    input.resetUrl,
    "",
    "If you didn't request this, you can ignore this email.",
    "This link expires in 1 hour.",
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdownToEmailHtml(markdownBody: string, appName: string) {
  const renderedBody = marked.parse(markdownBody, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 640px; margin: 0 auto; padding: 16px;">
      <div class="markdown-body" style="font-size: 16px;">
        ${renderedBody}
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
      <p style="color: #6b7280; font-size: 12px;">You're receiving this email because you have an account with ${escapeHtml(appName)}.</p>
    </div>
  `;
}

export async function sendBroadcastEmail(input: BroadcastEmailInput): Promise<BroadcastEmailResult> {
  if (input.recipients.length === 0) {
    throw new Error("No recipients available for broadcast email.");
  }

  const html = renderMarkdownToEmailHtml(input.markdownBody, input.appName);
  const text = input.markdownBody;
  const subject = input.subject.trim();

  const sendJobs = input.recipients.map(async (recipient) => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: input.from,
          to: [recipient.email],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          email: recipient.email,
          success: false as const,
          error: `Resend API error (${response.status}): ${errorBody}`,
        };
      }
      return { email: recipient.email, success: true as const };
    } catch (error) {
      return {
        email: recipient.email,
        success: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const settled = await Promise.allSettled(sendJobs);
  const results = settled.map((entry, index) => {
    if (entry.status === "fulfilled") {
      return entry.value;
    }
    return {
      email: input.recipients[index].email,
      success: false as const,
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    };
  });

  const delivered = results.filter((result) => result.success).length;
  const failures = results.flatMap((result) =>
    result.success ? [] : [{ email: result.email, error: result.error }]
  );

  return {
    attempted: results.length,
    delivered,
    failed: failures.length,
    failures,
  };
}
