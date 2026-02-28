import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/firebase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * /app/* 경로 및 인증 콜백 경로에만 미들웨어 적용
     * _next/static, _next/image, favicon.ico 등 정적 파일 제외
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
