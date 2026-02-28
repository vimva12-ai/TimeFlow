import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge Runtime 호환 미들웨어.
 * firebase-admin은 Node.js 전용이라 Edge에서 사용 불가.
 * 쿠키 존재 여부만 빠르게 확인하고,
 * 실제 서명 검증은 Server Component(layout.tsx)의 adminAuth.verifySessionCookie에서 수행.
 */
export async function updateSession(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;

  const { pathname } = request.nextUrl;
  const isProtected = ['/today', '/weekly', '/settings'].some((p) => pathname.startsWith(p));

  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
