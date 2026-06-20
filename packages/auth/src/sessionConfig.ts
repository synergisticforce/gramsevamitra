/** 6-month session lifetime (seconds). */
export const AUTH_SESSION_EXPIRES_SECONDS = 60 * 60 * 24 * 180;

/** Rolling refresh window — extend session when active within this period (seconds). */
export const AUTH_SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const authSessionConfig = {
  expiresIn: AUTH_SESSION_EXPIRES_SECONDS,
  updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
} as const;
