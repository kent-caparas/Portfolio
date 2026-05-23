import type { APIRoute } from 'astro';
import { getApprovedNotes } from '@/server/wall/storage';

export const prerender = false;

// Public read endpoint for the approved notes (used for client-side refresh).
export const GET: APIRoute = async ({ url }) => {
  const requested = Number(url.searchParams.get('limit'));
  const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 100, 100);
  const notes = await getApprovedNotes({ limit });
  return new Response(JSON.stringify({ ok: true, notes }), {
    headers: { 'content-type': 'application/json' },
  });
};
