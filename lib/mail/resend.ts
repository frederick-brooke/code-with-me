import "server-only";
import { Resend } from "resend";
import { DEFAULT_CODE_TTL_MS } from "@/lib/auth/engine";
import type { LoginCodeSender } from "@/lib/mail/types";

const API_KEY = process.env.EMAIL_API_KEY;
const FROM = process.env.EMAIL_FROM;

/** True when a transactional mail key is configured. When false, dev falls back to showing the code on screen. */
export const isMailConfigured = Boolean(API_KEY);

export const codeValidityMinutes = Math.round(DEFAULT_CODE_TTL_MS / 60000);

/**
 * Sends login emails through the Resend transactional email API. When no
 * API key is configured (local dev), sending silently no-ops; callers keep
 * their on-screen debug fallback so the flow stays usable offline.
 */
export function createResendLoginCodeSender(): LoginCodeSender {
  if (!API_KEY) {
    return { sendLoginCode: async () => undefined };
  }

  const resend = new Resend(API_KEY);

  return {
    async sendLoginCode(email) {
      const { error } = await resend.emails.send({
        from: FROM ?? "Code with Me <onboarding@resend.dev>",
        to: [email.to],
        subject: "Your code to sign in",
        html: `
<p>Use this code to sign in to Code with Me:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${email.code}</p>
<p>Or <a href="${email.magicLink}">sign in with this link</a>. The code expires in ${codeValidityMinutes} minutes.
If you didn't request it, you can ignore this email.</p>
`,
      });
      if (error) {
        throw new Error(`Login email failed: ${error.message}`);
      }
    },
  };
}