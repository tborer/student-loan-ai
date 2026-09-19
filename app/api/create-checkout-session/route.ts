import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

/**
 * POST /api/create-checkout-session
 *
 * Creates a one-time Stripe Checkout Session for the report unlock.
 *
 * The price comes from server env, never from the request body: a
 * client-supplied price could be swapped for any other price in the account.
 */
export async function POST(req: NextRequest) {
  const priceId = process.env.STRIPE_PRICE_ID;
  const clientUrl = process.env.CLIENT_URL;

  if (!process.env.STRIPE_SECRET_KEY || !priceId || !clientUrl) {
    console.error(
      'Stripe is not fully configured. Need STRIPE_SECRET_KEY, STRIPE_PRICE_ID and CLIENT_URL.'
    );
    return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const sessionToken = (body as { sessionToken?: unknown })?.sessionToken;
  if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
    return NextResponse.json({ error: 'Missing sessionToken.' }, { status: 400 });
  }

  // Keyed on the session token so a refresh or double-click reuses the same
  // Checkout Session instead of creating a second charge.
  const idempotencyKey = req.headers.get('x-idempotency-key') || `slr-checkout-${sessionToken}`;

  // Constructed per request, not at module scope: the Stripe client throws
  // when handed an empty key, and env vars are absent during `next build`.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        // Random token, never PII. Maps to the stored analysis result.
        client_reference_id: sessionToken,
        metadata: { sessionToken },
        allow_promotion_codes: true,
        success_url: `${clientUrl}/results?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/results?checkout=cancelled`,
      },
      { idempotencyKey }
    );

    if (!session.url) {
      console.error('Stripe returned a session with no URL:', session.id);
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 502 });
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    // Logged in full server-side (visible in Vercel logs); the client gets a
    // generic message so Stripe internals are not echoed to the browser.
    console.error('Stripe checkout session creation failed:', error);

    const isCardError =
      error instanceof Stripe.errors.StripeError && error.type === 'StripeCardError';

    return NextResponse.json(
      { error: isCardError ? 'Your card was declined.' : 'Could not start checkout.' },
      { status: isCardError ? 402 : 500 }
    );
  }
}
