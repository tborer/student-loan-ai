import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

/**
 * POST /api/webhook
 *
 * Verifies Stripe payment events. Payment is confirmed here, from a
 * signature-verified event, never from the browser redirect.
 *
 * App Router gives us the raw body via req.text(), which is what signature
 * verification needs -- the Pages-router `bodyParser: false` escape hatch
 * does not apply here.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    console.error('Webhook not configured. Need STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.');
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  // Constructed per request; see note in create-checkout-session/route.ts.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;

      // payment_status is the authoritative check; a completed session can
      // still be unpaid for async payment methods.
      if (session.payment_status === 'paid') {
        console.log(
          `[stripe] payment confirmed session=${session.id} ref=${session.client_reference_id}`
        );
        // TODO(ephemeral-store): mark this sessionToken as paid, TTL-bound,
        // so /results can unlock the detailed report. Until that store
        // exists, payment is recorded but nothing is unlocked server-side.
      }
      break;
    }

    case 'checkout.session.async_payment_failed': {
      console.warn(`[stripe] async payment failed session=${event.data.object.id}`);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      console.log(`[stripe] refund issued charge=${charge.id} amount=${charge.amount}`);
      // TODO(ephemeral-store): revoke report access for the related session.
      break;
    }

    default:
      console.log(`[stripe] unhandled event type: ${event.type}`);
  }

  // 2xx tells Stripe the event was received; otherwise it retries.
  return NextResponse.json({ received: true });
}
