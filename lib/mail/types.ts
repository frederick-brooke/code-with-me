/**
 * The boundary seam for delivering a login code to a Candidate. The
 * AuthEngine never sends mail itself; the server-action layer owns this
 * side effect, so tests and dev run without a real mail provider.
 */
export interface LoginCodeEmail {
  to: string;
  /** The bare 6-digit code, shown plainly for mail clients without rich html. */
  code: string;
  /** Absolute magic-link URL that auto-verifies the same code on click. */
  magicLink: string;
}

export interface LoginCodeSender {
  sendLoginCode(email: LoginCodeEmail): Promise<void>;
}