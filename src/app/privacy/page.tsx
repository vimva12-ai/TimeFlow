import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 — TimeFlow',
  description: 'TimeFlow 서비스의 개인정보 수집·이용에 관한 방침입니다.',
};

// 개인정보처리방침 섹션 데이터
const sections = [
  {
    id: '1',
    title: '수집하는 개인정보 항목',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          TimeFlow는 Google 로그인을 통해 다음 정보를 수집합니다.
        </p>
        <ul className="space-y-2">
          {[
            { label: '이름', desc: 'Google 계정에 등록된 표시 이름' },
            { label: '이메일 주소', desc: 'Google 계정 이메일 (로그인 식별 및 문의 응답용)' },
            { label: '프로필 사진', desc: 'Google 계정 프로필 이미지 URL' },
          ].map((item) => (
            <li
              key={item.label}
              className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              </span>
              <span>
                <strong className="font-medium">{item.label}</strong>
                <span className="text-gray-500 dark:text-gray-400"> — {item.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
          위 정보 외에 별도로 수집하는 개인정보는 없습니다. 시간 계획 데이터(타임테이블, 할 일 목록 등)는 개인정보가 아닌 서비스 이용 데이터로 분류됩니다.
        </p>
      </div>
    ),
  },
  {
    id: '2',
    title: '수집 및 이용 목적',
    content: (
      <ul className="space-y-2">
        {[
          '사용자 식별 및 로그인 인증',
          '개인 시간 계획 데이터의 저장·동기화·조회',
          '계정 관련 문의 응답 및 서비스 공지',
          '서비스 이용 통계 분석 및 기능 개선',
        ].map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
          >
            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: '3',
    title: 'Firebase를 통한 데이터 저장',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>
          TimeFlow는 Google의 <strong className="font-medium">Firebase</strong> 플랫폼을 사용하여 데이터를 저장하고 처리합니다.
        </p>
        <ul className="space-y-1.5 text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <li><strong className="text-gray-700 dark:text-gray-300">Firebase Authentication</strong> — Google 로그인 인증 처리</li>
          <li><strong className="text-gray-700 dark:text-gray-300">Firebase Firestore</strong> — 타임테이블·할 일 등 이용 데이터 저장</li>
        </ul>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          Firebase는 Google Cloud 인프라 위에서 운영되며, Google의 데이터 처리 약관이 적용됩니다.
          자세한 내용은{' '}
          <a
            href="https://firebase.google.com/support/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
          >
            Firebase 개인정보처리방침
          </a>
          을 참고하세요.
        </p>
      </div>
    ),
  },
  {
    id: '4',
    title: 'Google Analytics 사용',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>
          TimeFlow는 서비스 개선을 위해 <strong className="font-medium">Google Analytics</strong>를 사용합니다.
          다음과 같은 정보가 익명으로 수집될 수 있습니다.
        </p>
        <ul className="space-y-1.5 text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <li>페이지 방문 횟수 및 체류 시간</li>
          <li>주요 기능 사용 이벤트 (로그인, 블록 생성 등)</li>
          <li>기기 유형 및 브라우저 정보 (개인 식별 불가)</li>
        </ul>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          수집된 통계 데이터는 개인을 식별하는 데 사용되지 않으며, 서비스 기능 개선 목적으로만 활용됩니다.
          Google Analytics 데이터 처리에 대한 자세한 내용은{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
          >
            Google 개인정보처리방침
          </a>
          을 참고하세요.
        </p>
      </div>
    ),
  },
  {
    id: '5',
    title: '데이터 보관 기간',
    content: (
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <p>수집된 개인정보는 다음 기준에 따라 보관됩니다.</p>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">데이터 유형</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">보관 기간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">계정 정보 (이름·이메일·프로필)</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">계정 삭제 요청 시까지</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">타임테이블·할 일 데이터</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">계정 삭제 요청 시까지</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Analytics 통계 데이터</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">최대 14개월 (Google 정책 적용)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: '6',
    title: '데이터 삭제 요청 방법',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>
          계정 및 모든 관련 데이터의 삭제를 원하시면 아래 이메일로 요청해 주세요.
        </p>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-0.5">삭제 요청 이메일</p>
          <a
            href="mailto:vimva12@gmail.com"
            className="text-blue-700 dark:text-blue-300 font-medium hover:underline"
          >
            vimva12@gmail.com
          </a>
        </div>
        <ul className="space-y-1.5 text-gray-600 dark:text-gray-400 text-xs pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <li>요청 접수 후 <strong className="text-gray-700 dark:text-gray-300">30일 이내</strong>에 처리됩니다.</li>
          <li>삭제 시 복구가 불가능하며, 계정 및 모든 데이터가 영구 삭제됩니다.</li>
          <li>이메일에 가입 시 사용한 Google 계정 이메일 주소를 함께 기재해 주세요.</li>
        </ul>
      </div>
    ),
  },
  {
    id: '7',
    title: '문의처',
    content: (
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <p>개인정보 처리에 관한 문의는 아래로 연락해 주세요.</p>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          <div className="flex items-center px-4 py-2.5 bg-white dark:bg-gray-900">
            <span className="w-20 text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">서비스명</span>
            <span className="text-gray-700 dark:text-gray-300">TimeFlow</span>
          </div>
          <div className="flex items-center px-4 py-2.5 bg-white dark:bg-gray-900">
            <span className="w-20 text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">이메일</span>
            <a
              href="mailto:vimva12@gmail.com"
              className="text-blue-500 hover:text-blue-600 hover:underline"
            >
              vimva12@gmail.com
            </a>
          </div>
          <div className="flex items-center px-4 py-2.5 bg-white dark:bg-gray-900">
            <span className="w-20 text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">응답 기간</span>
            <span className="text-gray-700 dark:text-gray-300">영업일 기준 3일 이내</span>
          </div>
        </div>
      </div>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* 헤더 */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            TimeFlow로 돌아가기
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">개인정보처리방침</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            최종 업데이트: 2026년 3월 7일
          </p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            TimeFlow(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 소중히 여기며, 본 방침을 통해 수집·이용 현황을 투명하게 공개합니다.
          </p>
        </div>

        {/* 목차 */}
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">목차</p>
          <ol className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#section-${s.id}`}
                  className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors"
                >
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-4">{s.id}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* 섹션별 내용 */}
        {sections.map((s) => (
          <section
            key={s.id}
            id={`section-${s.id}`}
            className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-5 scroll-mt-6"
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                {s.id}
              </span>
              {s.title}
            </h2>
            {s.content}
          </section>
        ))}

        {/* 푸터 */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-4">
          © 2026 TimeFlow. 본 방침은 서비스 변경 시 사전 고지 후 업데이트될 수 있습니다.
        </p>
      </div>
    </div>
  );
}
