'use client';

import React, { useState } from 'react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A waitlist signup form that posts to /api/waitlist, which relays it over
 * SMTP server-side using the same transport as ContactForm.
 */
const WaitlistForm: React.FC = () => {
  const [email, setEmail] = useState('');
  // Honeypot: real visitors never see or fill this field. A filled value
  // means a bot, so the route reports success without actually sending.
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setStatus('sending');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to join the waitlist.');
      }

      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="contact-success" role="status">
        <p>Thanks — you&apos;re on the list. We&apos;ll email you when we&apos;re ready.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form" noValidate>
      <p className="contact-intro">
        Leave your email and we&apos;ll let you know as soon as we&apos;re ready.
      </p>

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="form-row">
        <label htmlFor="waitlist-email">Email *</label>
        <input
          id="waitlist-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      {/* Honeypot: kept out of the tab order and off-screen, not display:none
          (some bots skip display:none but still fill hidden fields). */}
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="waitlist-company">Company</label>
        <input
          id="waitlist-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={status === 'sending'}>
        {status === 'sending' ? 'Joining...' : 'Join Waitlist'}
      </button>
    </form>
  );
};

export default WaitlistForm;
