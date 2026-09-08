/** localStorage key for the GM-login remember-token fallback (see SessionResume.tsx and
 *  LoginForm.tsx) — shared as a constant so the writer (login) and readers (resume,
 *  logout) can't drift apart on the key name. */
export const REMEMBER_TOKEN_KEY = "unhl_remember_token";
