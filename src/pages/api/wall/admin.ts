import type { APIRoute } from 'astro';
import {
  getApprovedNotes,
  getPendingNotes,
  getRejectedNotes,
  softDeleteNote,
  updateNoteStatus,
} from '@/server/wall/storage';
import { audit } from '@/server/wall/audit';
import { ADMIN_COOKIE, isAdmin } from '@/server/wall/admin-auth';

export const prerender = false;

// Admin endpoint. Auth is either the session cookie (dashboard UI) or the raw
// token in the query string (curl/scripts). The query-string path is phase-2
// only; phase 3 replaces it with the Slack agent.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies.get(ADMIN_COOKIE)?.value, url.searchParams.get('token'))) {
    return json({ ok: false, error: 'Unauthorized.' }, 401);
  }

  switch (url.searchParams.get('action')) {
    case 'list-pending':
      return json({ ok: true, notes: await getPendingNotes({ limit: 200 }) });
    case 'list-approved':
      return json({ ok: true, notes: await getApprovedNotes({ limit: 200 }) });
    case 'list-rejected':
      return json({ ok: true, notes: await getRejectedNotes({ limit: 200 }) });
    default:
      return json({ ok: false, error: 'Unknown action.' }, 400);
  }
};

export const POST: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies.get(ADMIN_COOKIE)?.value, url.searchParams.get('token'))) {
    return json({ ok: false, error: 'Unauthorized.' }, 401);
  }

  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');
  if (!id) return json({ ok: false, error: 'Missing note id.' }, 400);

  if (action === 'approve' || action === 'reject') {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updated = await updateNoteStatus(id, newStatus);
    if (!updated) return json({ ok: false, error: 'Note not found.' }, 404);
    await audit({ actor: 'admin', action, noteId: id, after: { status: newStatus } });
    return json({ ok: true, note: updated });
  }

  if (action === 'delete') {
    const deleted = await softDeleteNote(id);
    if (!deleted) return json({ ok: false, error: 'Note not found.' }, 404);
    await audit({ actor: 'admin', action: 'delete', noteId: id, after: { status: 'deleted' } });
    return json({ ok: true, note: deleted });
  }

  return json({ ok: false, error: 'Unknown action.' }, 400);
};
