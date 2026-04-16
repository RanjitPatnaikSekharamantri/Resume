import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure verification token.
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Get token expiry date (24 hours from now).
 */
export function getTokenExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/**
 * Build the verification URL.
 */
export function buildVerificationUrl(token: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/verify-email?token=${token}`;
}

/**
 * Send a verification email.
 *
 * In production, replace this with your email provider (Resend, SendGrid, etc.).
 * For now, logs the link to the console as a development fallback.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = buildVerificationUrl(token);

  // Check for SMTP/email provider configuration
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "AI Career OS <noreply@example.com>",
          to: [email],
          subject: "Verify your email — AI Career OS",
          html: buildEmailHtml(name, verifyUrl),
        }),
      });

      if (!res.ok) {
        console.error("Email send failed:", await res.text());
      }

      return;
    } catch (err) {
      console.error("Email provider error:", err);
    }
  }

  // Development fallback: log to console
  console.log("\n══════════════════════════════════════════");
  console.log("  EMAIL VERIFICATION (dev mode)");
  console.log(`  To: ${email}`);
  console.log(`  Link: ${verifyUrl}`);
  console.log("══════════════════════════════════════════\n");
}

function buildEmailHtml(name: string, verifyUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #0F172A; margin-bottom: 8px;">Verify your email</h2>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
        Hi ${name || "there"},<br><br>
        Welcome to AI Career OS. Click the button below to verify your email address.
      </p>
      <a href="${verifyUrl}" style="display: inline-block; background: #2563EB; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin: 20px 0;">
        Verify Email
      </a>
      <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
        This link expires in 24 hours. If you didn't create an account, you can ignore this email.
      </p>
    </div>
  `;
}
