'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './components/Modal';
import ContactForm from './components/ContactForm';
import PrivacyPolicy from '@/components/terms-and-privacy/PrivacyPolicy';
import TermsOfService from '@/components/terms-and-privacy/TermsOfService';

type FooterModal = 'privacy' | 'terms' | 'contact' | null;

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [activeModal, setActiveModal] = useState<FooterModal>(null);

  return (
    <main className="home">
      {/* Hero Section */}
      <section className="hero" aria-labelledby="hero-heading">
        <div className="container">
          <h1 id="hero-heading">Find Ways to Lower Your Student Loan Payments</h1>
          <p className="subtitle">
            Get a personalized analysis of refinancing, income-driven repayment, 
            consolidation, and PSLF options in minutes. Free teaser results — 
            unlock your detailed plan with one-time payment.
          </p>
          
          {/* Optional email signup for report recovery */}
          <form 
            className="email-signup"
            onSubmit={(e) => { e.preventDefault(); console.log('Signup:', email); }}
            aria-label="Optional email signup for report recovery"
          >
            <input
              type="email"
              placeholder="Enter your email (optional, for report recovery)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="signup-help"
            />
            <span id="signup-help" className="help-text">
              We never store this email with your financial data.
            </span>
            <button 
              type="submit" 
              onClick={() => router.push('/loan-form')}
              disabled={!email}
              className="btn-continue"
            >
              Continue to Analysis
            </button>
          </form>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features" aria-labelledby="features-heading">
        <div className="container">
          <h2 id="features-heading">Why Choose Our Analyzer</h2>
          <div className="features-grid">
            <article className="feature-card">
              <span aria-hidden="true">📊</span>
              <h3>Compare Your Options</h3>
              <p>Analyze refinancing, income-driven repayment, consolidation, and PSLF to find ways to lower your payments.</p>
            </article>

            <article className="feature-card">
              <span aria-hidden="true">🔒</span>
              <h3>Privacy-First Approach</h3>
              <p>Your financial data never touches our servers. Everything processed securely and expires automatically.</p>
            </article>

            <article className="feature-card">
              <span aria-hidden="true">💰</span>
              <h3>Transparent Pricing</h3>
              <p>
                One-time fee for your analysis — no subscriptions, no hidden costs. Enrolling in
                IDR, consolidating, and applying for PSLF are always free directly through
                studentaid.gov; you&apos;re paying us for the comparison, not the filing.
              </p>
            </article>

            <article className="feature-card">
              <span aria-hidden="true">🎯</span>
              <h3>Actionable Results</h3>
              <p>Get specific numbers and direct links to start each repayment strategy.</p>
            </article>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta" aria-labelledby="cta-heading">
        <div className="container">
          <h2 id="cta-heading">Ready to See Your Options?</h2>
          <p>Start with our free analysis and unlock your detailed plan when you&apos;re ready.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        <nav aria-label="Footer navigation">
          <button type="button" className="footer-link" onClick={() => setActiveModal('privacy')}>
            Privacy Policy
          </button>
          <button type="button" className="footer-link" onClick={() => setActiveModal('terms')}>
            Terms of Service
          </button>
          <button type="button" className="footer-link" onClick={() => setActiveModal('contact')}>
            Contact
          </button>
        </nav>
        <p className="disclaimer">
          Educational tool only. Not financial, legal, or tax advice. Consult a qualified advisor before making decisions.
        </p>
        <p>&copy; {new Date().getFullYear()} Student Loan Repayment Analyzer</p>
      </footer>

      {activeModal === 'privacy' && (
        <Modal titleId="privacy-modal-title" title="Privacy Policy" onClose={() => setActiveModal(null)}>
          <PrivacyPolicy />
        </Modal>
      )}

      {activeModal === 'terms' && (
        <Modal titleId="terms-modal-title" title="Terms of Service" onClose={() => setActiveModal(null)}>
          <TermsOfService />
        </Modal>
      )}

      {activeModal === 'contact' && (
        <Modal titleId="contact-modal-title" title="Contact Us" onClose={() => setActiveModal(null)}>
          <ContactForm />
        </Modal>
      )}
    </main>
  );
}