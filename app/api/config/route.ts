import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/config
 *
 * Feature flags read server-side on every request rather than baked into the
 * client bundle via NEXT_PUBLIC_*, so flipping ENABLE_WAITLIST or
 * ENABLE_STRIPE in Vercel takes effect immediately, without a redeploy.
 *
 * Both default to enabled: unset means "on", and only an explicit "false"
 * turns a feature off while it's still being set up.
 */
export async function GET() {
  return NextResponse.json({
    enableWaitlist: process.env.ENABLE_WAITLIST !== 'false',
    enableStripe: process.env.ENABLE_STRIPE !== 'false',
  });
}
