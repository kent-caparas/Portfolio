import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import {
  getPendingNotes,
  getRejectedNotes,
  updateNoteStatus,
} from '@/server/wall/storage';
import { audit } from '@/server/wall/audit';
import { config } from '@/server/wall/config';

export const prerender = false;

// TEMPORARY phase-2 endpoint. A token in a query string is crude on purpose —
// it exists only until phase 3 replaces it with the Slack agent. Delete this
// file at the start of phase 3.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function tokenOk(provided: string | null): boolean {
  const expected = config.adminToken;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const GET: APIRoute = async ({ url }) => {
  if (!tokenOk(url.searchParams.get('token'))) return json({ ok: false, error: 'Unauthorized.' }, 401);

  const action = url.searchParams.get('action');
  if (action === 'list-pending') {
    return json({ ok: true, notes: await getPendingNotes({ limit: 200 }) });
  }
  if (action === 'list-rejected') {
    return json({ ok: true, notes: await getRejectedNotes({ limit: 200 }) });
  }
  return json({ ok: false, error: 'Unknown action.' }, 400);
};

export const POST: APIRoute = async ({ url }) => {
  if (!tokenOk(url.searchParams.get('token'))) return json({ ok: false, error: 'Unauthorized.' }, 401);

  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');
  if (!id) return json({ ok: false, error: 'Missing note id.' }, 400);
  if (action !== 'approve' && action !== 'reject') {
    return json({ ok: false, error: 'Unknown action.' }, 400);
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const updated = await updateNoteStatus(id, newStatus);
  if (!updated) return json({ ok: false, error: 'Note not found.' }, 404);

  await audit({ actor: 'admin', action, noteId: id, after: { status: newStatus } });
  return json({ ok: true, note: updated });
};
