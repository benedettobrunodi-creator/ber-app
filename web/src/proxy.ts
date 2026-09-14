import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /sw.js e /icones do PWA precisam ser públicos: service worker não pode ser
// servido atrás de redirect (o browser recusa o registro) — bug pego em 12/09.
const PUBLIC_PATHS = ['/login', '/api', '/uploads', '/manifest', '/sw.js', '/icone-', '/atualizacao'];
// /atualizacao/<token>: página pública do diário pro cliente (token uuid é a chave) — estava caindo no login (bug 14/09)

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
