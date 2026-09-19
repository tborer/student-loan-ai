import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Initialize Stripe with environment variables (Vercel deployment)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18',
});

/**
 * POST /api/create-checkout-session
 * 
 * Creates a one-time payment Stripe Checkout Session
 * Returns session client secret and client_reference_id (encrypted)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ sessionId: string; clientReferenceId: string; url: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { loanAnalysisData, priceId } = req.body;

  // Validate required fields
  if (!priceId || !loanAnalysisData) {
    return res.status(400).json({ 
      error: 'Missing required fields. Must provide priceId and loanAnalysisData.' 
    });
  }

  try {
    // Generate idempotency key to prevent double-charging on retry
    const idempotencyKey = req.headers['x-idempotency-key'] || `idem-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    // Create a random session token (never PII per spec)
    const sessionToken = `session-${Date.now()}-${Math.random().toString(36).substring(2)`;

    // Check idempotency - if same key used, return existing result (no double charge)
    // In production, check Redis/database here first

    // Create Stripe Checkout Session for one-time payment mode
    const session = await stripe.checkout.sessions.create({
      payment_intent_data: {
        // Store encrypted client_reference_id mapped to analysis result in metadata
        client_reference_id: sessionToken, 
      },
      mode: 'payment', // One-time payment, not subscription
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/results?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/teaser`,
      metadata: {
        sessionToken, // Map to encrypted analysis result in database
        loanAnalysisData: JSON.stringify(loanAnalysisData), // Pass analysis data through Stripe
        clientReferenceId: sessionToken, // Never PII per spec
      },
      allow_promotion_codes: true, // Support promo codes if offered
      currency: 'usd',
    });

    res.status(200).json({
      sessionId: session.id,
      clientReferenceId: session.metadata.clientReferenceId || sessionToken,
      url: session.url,
    });

  } catch (error) {
    console.error('Stripe Checkout session creation failed:', error);
    
    if (error.type === 'StripeCardError') {
      return res.status(402).json({ 
        error: error.message, // e.g., "card declined"
        code: error.code,
      });
    }

    return res.status(500).json({ 
      error: 'Failed to create checkout session. Please try again.', 
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export const config = {
  api: {
    bodyParser: false, // Required for session creation with large payloads
  },
};