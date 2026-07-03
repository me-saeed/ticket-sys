import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, createTicket } from '../api';
import type { NewTicket as NewTicketData } from '../types';
import { PRIORITIES, PRIORITY_LABELS } from '../types';

const EMPTY: NewTicketData = {
  title: '',
  description: '',
  customerName: '',
  customerEmail: '',
  // WHY medium as default: the least surprising middle ground; the user can
  // still change it, and the field can never be accidentally left "unset".
  priority: 'medium',
};

// WHY client-side validation duplicating the server's rules: instant feedback
// without a round-trip. The server remains the authority — its field errors
// are merged into the same `errors` state if anything slips through.
function validate(data: NewTicketData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title.trim()) errors.title = 'Title is required';
  if (!data.description.trim()) errors.description = 'Description is required';
  if (!data.customerName.trim()) errors.customerName = 'Customer name is required';
  if (!data.customerEmail.trim()) errors.customerEmail = 'Email is required';
  // WHY a simple pattern, not RFC 5322: catches real typos (missing @ or
  // domain) without rejecting valid unusual addresses.
  else if (!/^\S+@\S+\.\S+$/.test(data.customerEmail)) errors.customerEmail = 'Invalid email format';
  return errors;
}

export function NewTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof NewTicketData>(key: K, value: NewTicketData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // WHY clear the field's error while typing: stale "required" messages
    // next to a now-filled input are confusing.
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrors = validate(form);
    if (Object.values(clientErrors).some(Boolean)) return setErrors(clientErrors);

    setSubmitting(true);
    setSubmitError(null);
    try {
      const ticket = await createTicket(form);
      // WHY navigate to the new ticket: seeing the created ticket IS the
      // success feedback, and confirms it was persisted.
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      else setSubmitError(err instanceof Error ? err.message : 'Failed to create ticket');
      setSubmitting(false);
    }
  }

  // WHY a small field renderer: 4 text fields share identical label/input/
  // error markup — this keeps the JSX below readable without a form library.
  function field(key: keyof NewTicketData, label: string, textarea = false) {
    const props = {
      id: key,
      value: form[key],
      'aria-invalid': !!errors[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        set(key, e.target.value),
    };
    return (
      <div className="field">
        <label htmlFor={key}>{label} *</label>
        {textarea ? <textarea rows={4} {...props} /> : <input {...props} />}
        {errors[key] && <small className="error">{errors[key]}</small>}
      </div>
    );
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <Link to="/" className="muted">← All tickets</Link>
      <h2>New Ticket</h2>
      {field('title', 'Title')}
      {field('description', 'Description', true)}
      {field('customerName', 'Customer name')}
      {field('customerEmail', 'Customer email')}
      <div className="field">
        <label htmlFor="priority">Priority</label>
        <select id="priority" value={form.priority} onChange={(e) => set('priority', e.target.value as NewTicketData['priority'])}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>
      {/* WHY no status field: new tickets always start "open" (server-enforced) */}
      {submitError && <p className="error" role="alert">{submitError}</p>}
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Ticket'}
      </button>
    </form>
  );
}
