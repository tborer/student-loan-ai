import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

/**
 * GET /api/verify-payment?session_id=cs_...
 *
 * Confirms whether a Stripe Checkout Session actually paid, and hands back
 * the sessionToken (client_reference_id) it was created for.
 *
 * There is no separate paid-sessions store: Stripe's own API is the live
 * source of truth, so this asks Stripe directly rather than trusting a
 * locally cached flag that could go stale after a refund. The webhook still
 * logs `checkout.session.completed` for audit, but nothing needs to read
 * that log for the unlock to work.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id.' }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Stripe is not configured. Need STRIPE_SECRET_KEY.');
    return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    });
  } catch (error) {
    // Most commonly an unrecognized or malformed session_id -- never this
    // server's fault, so log quietly and tell the client it isn't paid
    // rather than surfacing Stripe internals.
    console.warn('Stripe session lookup failed:', error);
    return NextResponse.json({ paid: false });
  }

  // payment_status is the authoritative checkout-time signal; a completed
  // session can still be unpaid for async payment methods.
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ paid: false });
  }

  // payment_status does not flip on a later refund, so that has to be
  // checked separately via the charge itself.
  const paymentIntent =
    typeof session.payment_intent === 'object' && session.payment_intent !== null
      ? session.payment_intent
      : null;
  const latestCharge =
    paymentIntent && typeof paymentIntent.latest_charge === 'object'
      ? paymentIntent.latest_charge
      : null;

  if (latestCharge?.refunded) {
    return NextResponse.json({ paid: false, reason: 'refunded' });
  }

  return NextResponse.json({
    paid: true,
    sessionToken: session.client_reference_id ?? null,
  });
}
