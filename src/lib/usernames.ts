// Staff sign in with a username and password. Supabase Auth identifies users
// by email, so each username maps to a fixed address on a reserved domain that
// never receives mail (".invalid" cannot exist on the internet).

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export const USERNAME_RULES =
  "3 to 32 characters: lowercase letters, numbers, dots, dashes, or underscores. Start with a letter or number.";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function usernameToEmail(username: string, domain: string): string {
  const u = normalizeUsername(username);
  if (!isValidUsername(u)) {
    throw new Error("Invalid username.");
  }
  return `${u}@${domain}`;
}

export const PASSWORD_MIN_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 72) {
    return "Use 72 characters or fewer.";
  }
  return null;
}
