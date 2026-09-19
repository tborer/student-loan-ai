import React, { useState } from 'react';
import './components/landing-page.css';

// Types for our landing page
type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
};

interface LandingPageProps {
  onContinue?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onContinue }) => {
  const [email, setEmail] = useState<string>('');

  const features: FeatureCardProps[] = [
    {
      icon: '📊',
      title: 'Compare Your Options',
      description: 'Analyze refinancing, income-driven repayment, consolidation, and PSLF to find ways to lower your payments.',
    },
    {
      icon: '🔒',
      title: 'Privacy-First Approach',
      description: 'Your financial data never touches our servers. Everything processed securely and expires automatically.',
    },
    {
      icon: '💰',
      title: 'Transparent Pricing',
      description: 'One-time fee for your analysis - no subscriptions, no hidden costs.',
    },
    {
      icon: '🎯',
      title: 'Actionable Results',
      description: 'Get specific numbers and direct links to start each repayment strategy.',
    },
  ];

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Main navigation">
          <button type="button" className="skip-link" tabIndex={-1}>
            Skip to content
          </button>
          <div className="nav-brand">
            <h1>Student Loan Repayment Analyzer</h1>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="landing-main" aria-labelledby="hero-heading">
        <section className="hero-section" aria-labelledby="hero-heading">
          <h1 id="hero-heading">Find Ways to Lower Your Student Loan Payments</h1>
          <p className="hero-subtitle">
            Get a personalized analysis of refinancing, income-driven repayment, consolidation, and PSLF options in minutes.
            Free teaser results — unlock your detailed plan with one-time payment.
          </p>
          <form className="email-signup" aria-label="Optional email signup for report recovery">
            <label htmlFor="hero-email" className="visually-hidden">
              Email for report recovery
            </label>
            <input
              id="hero-email"
              type="email"
              placeholder="Enter your email (optional, for report recovery)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="email-help-text"
            />
            <span id="email-help-text" className="help-text">
              We never store this email with your financial data.
            </span>
            <button 
              type="submit" 
              onClick={onContinue}
              disabled={!onContinue}
              className="hero-btn"
              aria-label="Continue to loan analysis form"
            >
              Continue to Analysis
            </button>
          </form>
        </section>

        {/* Features Grid */}
        <section className="features-section" aria-labelledby="features-heading">
          <h2 id="features-heading">Why Choose Our Analyzer</h2>
          <div className="features-grid" role="list">
            {features.map((feature, index) => (
              <article key={index} className="feature-card" role="listitem">
                <span className="feature-icon" aria-hidden="true">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section" aria-labelledby="cta-heading">
          <h2 id="cta-heading">Ready to See Your Options?</h2>
          <p className="cta-subtitle">
            Start with our free analysis and unlock your detailed plan when you're ready.
          </p>
        </section>

        {/* Footer */}
        <footer className="landing-footer" role="contentinfo">
          <nav aria-label="Footer navigation">
            <a href="/about" rel="noopener noreferrer" target="_blank">About</a>
            <a href="/privacy" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
            <a href="/terms" rel="noopener noreferrer" target="_blank">Terms of Service</a>
            <a href="/contact" rel="noopener noreferrer" target="_blank">Contact</a>
          </nav>
          <p className="footer-disclaimer">
            Educational tool only. Not financial, legal, or tax advice. Consult a qualified advisor before making decisions.
          </p>
          <p className="copyright">&copy; {new Date().getFullYear()} Student Loan Repayment Analyzer</p>
        </footer>
      </main>

      {/* Visually-hidden styles */}
      <style>{`
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: #000;
          color: #fff;
          padding: 8px 12px;
          z-index: 100;
        }

        .skip-link:focus {
          top: 0;
        }

        .help-text {
          display: block;
          font-size: 0.75rem;
          color: #666;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;