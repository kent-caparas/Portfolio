import { defineMiddleware } from 'astro:middleware';
import { ADMIN_COOKIE, verifyAdminCookieValue } from '@/server/wall/admin-auth';

// Guard the admin area. /admin itself is the login page (always reachable);
// anything deeper requires a valid session cookie.
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const authed = verifyAdminCookieValue(context.cookies.get(ADMIN_COOKIE)?.value);
    if (!authed && pathname !== '/admin') {
      return context.redirect('/admin');
    }
  }
  return next();
});
