'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { analytics } from '@/lib/analytics';

const TERMS_KEY = 'timeflow-terms-agreed';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  // 이미 동의한 사용자 여부 (localStorage 확인)
  const [alreadyAgreed, setAlreadyAgreed] = useState(false);
  // 신규 사용자용 약관 동의 체크박스 상태
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // 클라이언트 사이드에서만 localStorage 접근
  useEffect(() => {
    setAlreadyAgreed(localStorage.getItem(TERMS_KEY) === 'true');
  }, []);

  // 이미 동의했거나 두 체크박스 모두 체크하면 로그인 버튼 활성화
  const canLogin = alreadyAgreed || (agreedPrivacy && agreedTerms);

  async function handleGoogleLogin() {
    if (!canLogin) return;
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      // 약관 동의 상태 저장 (다음 로그인 시 체크박스 생략)
      localStorage.setItem(TERMS_KEY, 'true');
      analytics.login('google');
      router.push('/today');
    } catch (err: unknown) {
      if (err instanceof Error) setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600">TimeFlow</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Plan vs Actual 타임 트래커</p>
        </div>

        {/* 약관 동의 섹션: 이미 동의한 사용자는 간소화 표시 */}
        {alreadyAgreed ? (
          <div className="flex items-center justify-between px-1 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-700 dark:text-green-300">이미 약관에 동의하셨습니다.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <Link href="/privacy" target="_blank" className="hover:underline">개인정보</Link>
              <span>·</span>
              <Link href="/terms" target="_blank" className="hover:underline">이용약관</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
                  agreedPrivacy
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-blue-500'
                }`}>
                  {agreedPrivacy && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight">
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  개인정보처리방침
                </Link>
                에 동의합니다
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
                  agreedTerms
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-blue-500'
                }`}>
                  {agreedTerms && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight">
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  이용약관
                </Link>
                에 동의합니다
              </span>
            </label>
          </div>
        )}

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          disabled={!canLogin || loading}
          className={`w-full flex items-center justify-center gap-3 py-3 px-4 border rounded-lg transition-colors ${
            canLogin
              ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          } disabled:opacity-60`}
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill={canLogin ? '#4285F4' : '#9CA3AF'} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill={canLogin ? '#34A853' : '#9CA3AF'} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill={canLogin ? '#FBBC05' : '#9CA3AF'} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill={canLogin ? '#EA4335' : '#9CA3AF'} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? '로그인 중...' : 'Google로 로그인'}
        </button>

        {message && (
          <p className="text-sm text-center text-red-500">{message}</p>
        )}
      </div>
    </div>
  );
}
