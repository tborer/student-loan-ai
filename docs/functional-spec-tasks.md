# Student Loan Repayment Analyzer — Task Specification

### 1.1 Landing Page & Static Frontend Setup

Build a static React single-page app with Vercel/Netlify/CloudFront hosting. Create landing page component that presents a clear value proposition, collects basic contact info if desired (no account needed), and routes users to the intake form. Include accessibility (WCAG 2.1 AA), mobile-first responsive layout, and performance targeting under 5s load time. Set up build pipeline with Vite or similar tooling.

### 1.2 Input Form: Loan & Borrower Data Collection

Implement client-side loan/borrower input form with validation. Fields required per loan: type (Direct Subsidized/Unsubsidized, Direct PLUS, FFEL, Perkins, Private), balance (> $0), interest rate (0–25%), optional servicer. Fields for borrower: annual gross income (≥$0), household size, filing status (single/married jointly/separately), state of residence (optional), employment sector (nonprofit/government/PSLF flag/private/self-employed), years in qualifying repayment (optional), credit score band (<650 / 650–699 / 700–749 / 750+ optional). Client-side range checking on all numeric fields with inline errors. Optional fields labeled as "improves accuracy." At least one loan required. Form submits analysis request to backend.

### 1.3 Privacy-First Data Handling Layer

Implement ephemeral data handling: TLS everywhere, no plaintext persistence of sensitive borrower info beyond TTL-bound record (24-72 hours) for bridging free results to paid report. No SSN or credentials collected. Stripe handles PCI compliance entirely. Implement automatic expiry (TTL) on ephemeral store records. Add user-facing "delete my data now" action before session expiry. All sensitive data in-memory over TLS, discarded after response, with TTL-keyed encrypted blob for session bridge.

### 1.4 Analysis Engine: Core Configuration & Eligibility Rules

Build analysis engine with refreshable configuration (no hardcoded constants). Implement eligibility rules from current landscape (as of Sep 2026): SAVE vacated Mar 10, 2026; IBR permanent status; RAP effective Jul 1, 2026; PAYE/ICR closed to new enrollees Jul 1, 2026. Implement refinance logic: balance-weighted current rate vs. configurable illustrative-rate-by-credit-tier table, flag when rate gap times remaining balance implies meaningful savings. Mandatory warning for any federal loan: refinancing converts to private, forfeits IDR/RAP/PSLF/deferment/forgiveness.

### 1.5 Analysis Engine: Income-Driven Repayment Logic (IBR/RAP)

Implement income-driven repayment calculations for federal Direct loans only. Discretionary-income formula: AGI minus (poverty line multiplier × federal poverty guideline by household size). Monthly payment = max(payment % × discretionary income / 12, plan minimum). Implement both IBR and RAP where eligible; surface lower payment plus trade-off note (RAP waives unpaid interest but $10/month minimum no low-end cap beyond; IBR retains 20/25-year forgiveness framing). Store RAP as separate bracket-lookup structure against AGI (1%-10% by bracket), not forcing through discretionary income formula. If estimated payment below user's stated current payment, surface as relief option. Handle $0 income case as valid result (not error).

### 1.6 Analysis Engine: Consolidation & PSLF Logic

Implement consolidation logic for FFEL/Perkins/Parent PLUS loans. Hardcode deadline June 30, 2026 check at runtime: pre-deadline recommend consolidation as IDR/PSLF prerequisite; post-deadline show permanent eligibility loss for those loan types (consolidation now only rate-averaging/simplification). New rate = weighted average rounded up to nearest 1/8%. Implement PSLF logic: federal Direct loans, qualifying employer (nonprofit/government), qualifying repayment plan, 120 qualifying payments. Implement Jul 1, 2026 rule excluding employers with "substantial illegal purpose" prospectively. If user supplies years in qualifying employment, estimate progress toward 120 payments; otherwise show eligibility only. Flag legacy 20/25-year IDR forgiveness and any state-specific program matched by optional state field.

### 1.7 Analysis Engine: Strategy Scoring & Ranking

Implement scoring algorithm for each applicable strategy: score refinance/IDR by estimated dollar impact (savings); score consolidation/forgiveness by eligibility strength. Present ranked in that order: strategies with higher dollar impact or eligibility first; ineligible strategies omitted entirely, never shown as "not recommended." Score and rank on server-side analysis function.

### 1.8 Free-Tier Teaser Results Component

Build free results component showing count of eligible strategies ("We found X ways to potentially lower your payments"), one plain-language headline per strategy (no dollar figures or provider names: "Refinancing could lower your rate," "You may qualify for income-driven repayment," etc.), one fuzzy rounded combined savings range (e.g., "$1,200-$4,800/year potential" labeled as rough estimate), locked/blurred cards for exact numbers/action steps/provider links with unlock CTA. No email/account required to view this screen.

### 1.9 Payment Gate: Stripe Checkout Integration

Implement Stripe Checkout integration. On "Unlock full report" click: backend creates Stripe Checkout Session (one-time payment mode) with client_reference_id set to random session token (never PII). User completes payment on Stripe-hosted checkout. Stripe redirects to success_url with session_id, sends checkout.session.completed webhook separately. Backend verifies payment status via Stripe API - never trust client-side redirect alone. On verified payment: backend issues short-lived signed access token scoped to that session for fetching detailed report from ephemeral store. Failure/cancel returns user to free results screen with retry CTA; idempotency key on session creation prevents double-charging.

### 1.10 Paid-Tier Detailed Report & Provider Links Display

Build paid tier detailed report component: per recommended strategy show estimated new payment, monthly/annual/lifetime savings, trade-offs from analysis engine, short action checklist. Accessible via magic link for defined window (7 days), can optionally download or print. Provider links by strategy: Refinance → 2-4 curated private lenders/comparison site with FTC-compliant affiliate disclosure; Federal IDR (IBR/RAP) → studentaid.gov application portal (official government, no affiliate); Consolidation → studentaid.gov consolidation application (official); PSLF → studentaid.gov/pslf + PSLF Help Tool (official). Provider directory config-driven (strategy type, name, URL, description, affiliate flag, state/credit-tier restrictions), not hardcoded.

### 1.11 Terms of Service & Privacy Policy Generation

Create ToS and Privacy Policy components. ToS: clarify this is educational estimation tool, not financial/legal/tax advice; users should consult qualified advisor or loan servicer/studentaid.gov; prohibit unauthorized use; accuracy disclaimer that figures are estimates and actual terms may differ; privacy policy discloses exactly what's collected, why, retention window, Stripe as payment processor. Privacy Policy: no persistent storage beyond TTL; Stripe handles PCI; ephemeral serverless model explanation; "delete my data now" action disclosed; compliance with state-specific financial-advice regulations noted where applicable.

### 1.12 Legal & Compliance Disclaimer Component

Build persistent disclaimer component on all pages: educational estimation not financial/legal/tax advice; consult qualified advisor or loan servicer/studentaid.gov; no personalized fiduciary advice language; FTC-compliant affiliate disclosure wherever provider link is affiliate/referral; accuracy disclaimer noting figures are estimates and actual terms may differ. State-specific regulatory notes for financial-advice-adjacent tools where applicable. Link to full ToS before payment.

### 1.13 Configuration Management: Regulatory Tables & Rules

Implement config-driven storage for regulatory tables (federal repayment plan status, RAP bracket table on AGI, IDR plan minimums/payment %, federal poverty guideline by household size/state). Store in server-side location with update mechanism. Implement deadline tracking (consolidation June 30, 2026; PSLF substantial illegal purpose rule Jul 1, 2026; other regulatory changes). Config must be refreshable, not hardcoded.

### 1.14 Configuration Management: Lender Rate Table & Provider Directory

Implement config-driven lender rate table by credit tier (populated from rate-comparison sites, refreshed periodically - no live third-party API per spec). Implement provider directory with strategy type, name, URL, description, affiliate flag, state and credit-tier restrictions. Both stored server-side for central updates as landscape changes often.

### 1.15 Non-Functional: Performance & Availability Targets

Implement performance monitoring and optimization targeting form-to-results under 3s client-side or under 5s with serverless round trip. Target 99.5%+ availability (realistic for serverless architecture). Implement caching, lazy loading, efficient analysis algorithm. Use CDN for static assets; minify/compress build artifacts.

### 1.16 Non-Functional: Security & Bot Protection

Implement TLS everywhere on all endpoints. Implement Stripe webhook signature verification. Implement rate limiting and bot protection on analysis endpoint (e.g., Cloudflare, similar service). Implement proper HTTP security headers. Ensure secure handling of ephemeral session tokens.

### 1.17 Edge Cases: Private-Only Loan User Flow

Handle edge case: all-private-loan user → skip IDR/PSLF/federal-consolidation sections entirely, show refinance only. Modify analysis engine output rendering to conditionally hide ineligible strategy cards/sections.

### 1.18 Edge Cases: FFEL/Perkins Past Deadline Handling

Handle edge case: FFEL/Perkins/Parent PLUS holder past June 30, 2026 consolidation deadline → show permanent-eligibility-loss message from analysis engine config, not generic "consolidate now" nudge. Implement date-check in consolidation logic branch for this specific scenario.

### 1.19 Edge Cases: Session Expiry & Recovery Flow

Handle edge case: paid user's session expires before viewing report → implement recovery via opted-in magic link email or Stripe receipt lookup within report's access window (7 days assumed). Store magic link claim token in ephemeral store with expiry tracking. Stripe receipt lookup implemented as fallback option.

### 1.20 Edge Cases: Duplicate/Rapid Resubmission Handling

Handle edge case: duplicate/rapid resubmission → idempotency key on checkout session creation prevents double-charging. Generate idempotency-key header for each checkout request; backend tracks and honors it to prevent charging same user twice for same analysis intent.

### 1.21 Edge Cases: Out-of-Range Input Validation

Handle edge cases: out-of-range inputs (e.g., 200% interest rate) → caught by client-side validation before submit, inline error shown with correction guidance. Implement robust input sanitization and range checking for all numeric fields.

### 1.22 Success Metrics & Analytics Integration

Implement analytics tracking for funnel drop-off by step: form start completion, form complete, results view, checkout start, checkout complete; free-to-paid conversion rate calculation; average revenue per completed analysis (track price point); refund/chargeback rate monitoring via Stripe dashboard integration; provider-link click-through (post-purchase) tracking to measure report effectiveness. No personally identifiable analytics without consent.

### 1.23 Out of Scope Items Documentation

Document out-of-scope for v1: user accounts/login, saved report history, live rate APIs, in-app loan applications/origination, native mobile app, multi-language support, subscription billing. Ensure no feature creep attempts to implement these. Maintain clear boundary between scope and future enhancements.