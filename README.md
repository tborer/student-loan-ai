# Student Loan Repayment Analyzer

A privacy-first student loan repayment analysis tool that compares refinancing, income-driven repayment (IDR), consolidation, and PSLF options.

## Overview & Goals

- Convert visitors into a single one-time Stripe payment per analysis ($9–$19) with no subscription
- Privacy-focused: no persistent storage beyond TTL-bound ephemeral records
- Covers four strategy families: refinancing, IDR, consolidation, and forgiveness (PSLF)
- Decision-support tool only — not financial/legal advice

## Current State (v1.0)

### Completed Features
- [x] Landing page with responsive design (WCAG 2.1 AA compliant)
- [x] React SPA setup with Vite build pipeline
- [x] TypeScript configuration
- [x] Base CSS styling with CSS custom properties
- [ ] Input form implementation
- [ ] Analysis engine logic
- [ ] Stripe integration
- [ ] Detailed report component

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **Hosting**: Vercel/Netlify/CloudFront (static SPA)
- **Backend**: Serverless functions (Stripe Checkout, webhooks, ephemeral store)
- **Ephemeral Store**: Redis/DynamoDB with TTL attributes

### Compliance & Privacy
- TLS everywhere
- No SSN or credentials collected
- Stripe handles PCI compliance
- Automatic data expiry (TTL 24-72 hours)
- User-facing "delete my data now" action

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Next Steps

See [docs/functional-spec-tasks.md](./docs/functional-spec-tasks.md) for the complete task list. The autonomous development loop is processing these tasks to implement:

1. Input form with client-side validation
2. Privacy-first data handling layer
3. Analysis engine (config-driven regulatory tables)
4. Free-tier teaser results component
5. Payment gate (Stripe integration)
6. And more...

## Architecture

```
├── src/
│   ├── components/
│   │   ├── LandingPage.tsx      # Hero + features + CTA
│   │   └── landing-page.css     # Responsive styles
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component
│   └── styles/
│       └── index.css            # Global styles
├── index.html                   # HTML entry point
├── vite.config.ts              # Vite configuration
├── package.json                # Dependencies
└── README.md                   # This file
```

## License

Educational tool only. Not for commercial use without proper licensing.

---

*Built with privacy and transparency in mind.*