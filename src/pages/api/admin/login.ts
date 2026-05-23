import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, makeAdminCookieValue, tokenMatches } from '@/server/wall/admin-auth';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  if (!tokenMatches(body?.token)) {
    return json({ ok: false, error: 'Invalid token.' }, 401);
  }

  cookies.set(ADMIN_COOKIE, makeAdminCookieValue(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return json({ ok: true });
};
