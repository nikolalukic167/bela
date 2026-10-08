// Username accounts sit on Convex Auth's Password provider, which identifies an account by
// "email". We map a username to a reserved, non-routable address so no real email is needed
// (and none is ever sent). Shared by the client form and convex/auth.ts.
export const USERNAME_DOMAIN = 'users.karte.invalid';
export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/;
export const PASSWORD_MIN = 8;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export const isValidUsername = (raw: string) => USERNAME_PATTERN.test(normalizeUsername(raw));

export const usernameToEmail = (raw: string) => `${normalizeUsername(raw)}@${USERNAME_DOMAIN}`;

/** The username inside a reserved address, or null when the address is anything else. */
export function emailToUsername(email: string): string | null {
  const suffix = `@${USERNAME_DOMAIN}`;
  if (!email.endsWith(suffix)) return null;
  const name = email.slice(0, -suffix.length);
  return USERNAME_PATTERN.test(name) ? name : null;
}
