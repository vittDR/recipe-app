// Keeps an invite code across sign-up (the join link may be opened signed out).
const KEY = 'dineamite.invite';

export function rememberInvite(code: string) {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // storage unavailable
  }
}

export function pendingInviteCode(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}
