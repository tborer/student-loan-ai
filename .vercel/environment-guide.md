# Student Loan Repayment Analyzer — Vercel Environment Variables Setup Guide

## Quick Start (5 minutes)

1. **Create your Stripe account** at https://dashboard.stripe.com/register (if you don't have one)
2. **Add environment variables** in your Vercel project settings
3. **Deploy** to production and test payments

---

## Required Environment Variables

### 1. Stripe API Credentials

| Variable Name | Value Format | Where to Get It | When to Change |
|--------------|-------------|-----------------|----------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Stripe Dashboard > Developers > API Keys | Always (your secret key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Webhooks > Add Signing Endpoint | Always (webhook signature verification) |

**How to get your webhook signing secret:**
1. In Stripe Dashboard: https://dashboard.stripe.com/test/webhooks (or `/live/webhooks` for production)
2. Click "Add endpoint"
3. Enter your Vercel deployment URL: `https://your-app.vercel.app/api/webhook`
4. Enable "Sign all events" or select specific event types
5. Copy the **Signing Secret** (`whsec_...`) - NOT the Webhook Secret
6. Paste it as `STRIPE_WEBHOOK_SECRET` in Vercel

### 2. Stripe Price ID

| Variable Name | Value Format | Where to Get It | When to Change |
|--------------|-------------|-----------------|----------------|
| `NEXT_PUBLIC_STRIPE_PRICE_ID` | `price_1ABC...` | Stripe Products > Create Product > Create Price | When you set your price point |

**How to create a Stripe Product & Price:**
1. Go to Stripe Dashboard: https://dashboard.stripe.com/test/products (or `/live/products`)
2. Click "Create Product"
3. Name: "Student Loan Analysis Report"
4. Description: "One-time analysis of refinancing, IDR, consolidation, PSLF options"
5. Click "Create"
6. In the product dashboard, click "Add price" or edit existing price
7. Set `Unit Amount` (e.g., 900 for $9.00)
8. Select currency: `usd`
9. Set billing cycle to "one-time" (not recurring)
10. Copy the **Price ID** (`price_...`)
11. Add as environment variable in Vercel: `NEXT_PUBLIC_STRIPE_PRICE_ID=price_...`

---

## Optional but Recommended Environment Variables

| Variable | Default Value | Purpose | When to Set |
|----------|---------------|---------|-------------|
| `CLIENT_URL` | auto-detected | Your deployment domain (for redirect URLs) | Production only |
| `MAGIC_LINK_EXPIRY_HOURS` | `168` (7 days) | How long paying users can access report via magic link | Customize as needed |
| `STRIPE_CURRENCY` | `usd` | Currency for Stripe charges | Set if using another currency |
| `ENABLE_ANALYTICS` | `false` | Enable Google Analytics/PostHog (v1: disabled per spec) | When ready for analytics |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `60` | Protect against abuse on analysis endpoint | Production security |

---

## Production vs Development Setup

### Test Mode (Recommended Starting Point)
- Use `sk_test_...` test Stripe keys
- Set `NEXT_PUBLIC_VERCEL_ENV=development` in Vercel settings
- Process payments with test cards: `4242 4242 4242 4242` (works for all test cards)

### Production Mode
- Use `sk_live_...` live Stripe keys
- Set `NEXT_PUBLIC_VERCEL_ENV=production` in Vercel settings
- Requires domain verification: https://dashboard.stripe.com/test/account/payment_methods
- Enable webhook URL redirection to your production deployment URL

---

## Adding Variables in Vercel Dashboard

1. Go to your project: https://vercel.com/dashboard/{your-project}/settings
2. Click "Environment Variables" tab
3. Click "New variable" for each required variable above
4. Set `Key` (e.g., `STRIPE_SECRET_KEY`) and `Value`
5. Select target environments: Development, Production
6. Click "Save"
7. **Redeploy** your project after adding variables

---

## Troubleshooting

### "Invalid Stripe key" errors
- Ensure you're using test keys with `sk_test_` prefix for testing
- Test mode URLs: https://dashboard.stripe.com/test/*
- Copy full key from Stripe Dashboard, don't trim leading characters

### "Webhook signature verification failed"
- Webhook signing secret starts with `whsec_`, NOT the webhook endpoint URL
- In Stripe, verify you selected "Sign all events" or added specific event types
- Ensure your Vercel deployment URL matches what you configured in Stripe

### Environment variables not loading
- Check Vercel logs: https://vercel.com/dashboard/{your-project}/logs
- Add `console.log(process.env.STRIPE_SECRET_KEY?.substring(0, 10))` to verify loading
- Ensure variables are set for the correct environment (Development vs Production)

---

## Security Considerations

✅ **DO:**
- Never commit `.env.local` or environment variable values to Git
- Use Vercel's built-in secret management
- Rotate keys periodically (at least annually)
- Use different test/live keys in separate environments

❌ **DON'T:**
- Hardcode Stripe credentials in source code
- Share webhook secrets publicly
- Use test keys in production (real money!)
- Store sensitive data client-side without encryption

---

## Next Steps After Setup

1. ✅ Environment variables added and verified in Vercel logs
2. 📱 Test checkout flow with test card `4242 4242 4242 4242`
3. 🔗 Configure webhook endpoint URL in Stripe Dashboard
4. 🚀 Deploy to production with live keys when ready
5. 📊 Add analytics (Task 1.22) once payment flow is working

---

*Need help? Check Stripe documentation at https://stripe.com/docs or Vercel docs at https://vercel.com/docs.*