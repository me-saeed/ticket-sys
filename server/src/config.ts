// WHY a dev fallback secret: the reviewer can clone-and-run with zero setup.
// The name makes the risk impossible to miss; production MUST set JWT_SECRET
// (and .env.example documents it). Never commit a real secret.
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

// WHY 8h: one support shift. Long enough that agents aren't re-logging in
// mid-work, short enough that a leaked token dies the same day.
export const JWT_EXPIRES_IN = '8h';
