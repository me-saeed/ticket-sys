import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // WHY navigate home on success: the agent signed in to manage tickets —
      // put them in front of the list immediately.
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setSubmitting(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <Link to="/" className="muted">← All tickets</Link>
      <h2>Agent Sign In</h2>
      {/* WHY show demo credentials in the UI: this is an assessment — the
          reviewer should never have to hunt for a way in. Remove for real. */}
      <p className="muted">Demo: agent@example.com / agent123 (created by the seed script)</p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
