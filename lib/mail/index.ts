import "server-only";
import { isMailConfigured } from "@/lib/mail/resend";
import type { LoginCodeSender } from "@/lib/mail/types";
import { createResendLoginCodeSender } from "@/lib/mail/resend";

export { isMailConfigured };

export const loginCodeSender: LoginCodeSender = createResendLoginCodeSender();