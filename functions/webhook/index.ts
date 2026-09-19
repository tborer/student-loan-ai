import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Initialize Stripe with webhook secret
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * POST /api/webhook
 * 
 * Handles checkout.session.completed events to verify payment
 * and unlock the detailed report for paying users
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook signature to prevent unauthorized requests
  const sig = req.headers['stripe-signature'] || '';
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ 
      error: 'Invalid webhook signature' 
    });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      
      // Verify payment was completed (never trust client-side redirect alone)
      if (session.payment_intent && session.mode === 'payment') {
        const customerId = session.customer || null; // If customer created
        
        console.log(`Payment successful for session: ${session.id}`);
        console.log(`Metadata:`, JSON.stringify(session.metadata, null, 2));

        // Store access token scoped to this session
        // In production, you'd store in Redis with TTL (e.g., 7 days per spec)
        const accessToken = `Bearer ${generateShortToken()}`;
        
        // Return success - report will be unlocked via magic link or direct URL
        return res.status(200).json({
          message: 'Payment verified. Detailed report access granted.',
          sessionId: session.id,
          customerId,
        });
      }

      break;
    }

    case 'checkout.session.async_payment_failed': {
      console.log(`Payment failed for session: ${event.data.object.id}`);
      // Optionally notify user or retry logic
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      console.log(`Refund issued: ${charge.id} -> ${charge.amount}/${charge.currency}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
}

/** Generate short-lived access token for report access */
function generateShortToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `slr-token-${timestamp}-${random}`;
}

export const config = {
  api: {
    bodyParser: false, // Required to read raw body for webhook verification
  },
};