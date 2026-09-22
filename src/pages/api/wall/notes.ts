import type { APIRoute } from 'astro';
import { getApprovedNotes } from '@/server/wall/storage';

export const prerender = false;

// Public read endpoint for the approved notes (used for client-side refresh).
export const GET: APIRoute = async ({ url }) => {
  const requested = Number(url.searchParams.get('limit'));
  const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 100, 100);
  const headers = { 'content-type': 'application/json' };
  try {
    const notes = await getApprovedNotes({ limit });
    return new Response(JSON.stringify({ ok: true, notes }), { headers });
  } catch (err) {
    // same guard as the wall page, storage being down is not a crash
    console.error('[wall] failed to load approved notes:', err);
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers });
  }
};
