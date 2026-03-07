import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관 — TimeFlow',
  description: 'TimeFlow 서비스 이용약관입니다.',
};

// 이용약관 섹션 데이터
const sections = [
  {
    id: '1',
    title: '서비스 소개 및 목적',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>
          <strong className="font-medium">TimeFlow</strong>는 개인의 하루 시간 계획(Plan)과 실제 활동(Actual)을 기록·비교할 수 있는 타임 트래킹 웹 서비스입니다.
        </p>
        <ul className="space-y-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <li className="text-gray-600 dark:text-gray-400">일일 타임테이블 계획 수립 및 기록</li>
          <li className="text-gray-600 dark:text-gray-400">주간 시간 사용 통계 및 분석</li>
          <li className="text-gray-600 dark:text-gray-400">할 일 목록(Todo) 관리</li>
          <li className="text-gray-600 dark:text-gray-400">뽀모도로 타이머 기능</li>
        </ul>
        <p className="text-gray-600 dark:text-gray-400">
          본 약관은 TimeFlow 서비스(이하 &ldquo;서비스&rdquo;)를 이용하는 모든 사용자에게 적용됩니다. 서비스에 접속하거나 이용함으로써 본 약관에 동의한 것으로 간주합니다.
        </p>
      </div>
    ),
  },
  {
    id: '2',
    title: '사용자 의무사항',
    content: (
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">다음 사항을 준수해 주세요.</p>
          <ul className="space-y-2">
            {[
              '본인의 Google 계정을 통해 로그인하며, 타인의 계정을 무단으로 사용하지 않는다.',
              '서비스를 통해 타인의 권리를 침해하거나 불법적인 활동에 사용하지 않는다.',
              '서비스의 정상적인 운영을 방해하는 행위(과도한 자동화 요청, 크롤링 등)를 하지 않는다.',
              '서비스 내 데이터를 무단으로 수집·복제·재배포하지 않는다.',
            ].map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300"
              >
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-xs font-medium text-green-600 dark:text-green-400">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">다음 행위는 금지됩니다.</p>
          <ul className="space-y-2">
            {[
              '서비스의 보안 취약점을 악용하거나 시스템에 무단으로 접근하는 행위',
              '악성 코드, 스크립트 등을 주입하거나 서비스를 변조하는 행위',
              '허위 정보를 입력하거나 다른 사용자를 사칭하는 행위',
            ].map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-gray-600 dark:text-gray-400"
              >
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-xs font-medium text-red-500 dark:text-red-400">
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: '3',
    title: '서비스 이용 제한 조건',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>다음에 해당하는 경우 사전 고지 없이 서비스 이용을 제한하거나 계정을 해지할 수 있습니다.</p>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">사유</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                ['본 약관 위반 행위', '경고 후 이용 정지 또는 즉시 해지'],
                ['타인의 권리 침해 또는 불법 행위', '즉시 이용 정지 및 해지'],
                ['장기간 미사용 (12개월 이상)', '사전 안내 후 계정 비활성화'],
                ['서비스 운영에 심각한 지장을 주는 행위', '즉시 이용 정지'],
              ].map(([reason, action], i) => (
                <tr key={i} className="bg-white dark:bg-gray-900">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{reason}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          이용 제한에 이의가 있는 경우 <a href="mailto:vimva12@gmail.com" className="text-blue-500 hover:underline">vimva12@gmail.com</a>으로 문의해 주세요.
        </p>
      </div>
    ),
  },
  {
    id: '4',
    title: '면책조항',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">주의</p>
          <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            TimeFlow는 개인 생산성 도구로 제공되며, 서비스 이용으로 인한 결과에 대해 법적 책임을 지지 않습니다.
          </p>
        </div>
        <ul className="space-y-2.5">
          {[
            '서비스는 &ldquo;있는 그대로(AS-IS)&rdquo; 제공되며, 특정 목적에 대한 적합성을 보증하지 않습니다.',
            '천재지변, 서버 장애, 네트워크 오류 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.',
            '사용자가 서비스에 저장한 데이터의 손실·유출에 대해, 합리적 보안 조치를 취했음에도 발생한 경우 책임을 지지 않습니다.',
            '서비스와 연동된 외부 서비스(Google, Firebase 등)의 장애로 인한 손해에 대해 책임지지 않습니다.',
            '사용자 간 또는 사용자와 제3자 간의 분쟁에 개입하거나 책임지지 않습니다.',
          ].map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-gray-600 dark:text-gray-400"
              dangerouslySetInnerHTML={{
                __html: `<span class="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500">•</span><span>${item}</span>`,
              }}
            />
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: '5',
    title: '서비스 변경 및 중단 안내',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>서비스는 다음과 같은 경우 변경되거나 중단될 수 있습니다.</p>
        <ul className="space-y-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
          <li>기능 개선·업데이트를 위한 점검 (사전 공지 원칙)</li>
          <li>서버 인프라 이전 또는 기술적 환경 변화</li>
          <li>운영 정책 변경 또는 서비스 종료 결정</li>
          <li>불가항력적 사유(재해, 법적 규제 등)</li>
        </ul>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3 text-xs">
          <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">공지 방법</p>
          <p className="text-blue-600 dark:text-blue-300 leading-relaxed">
            서비스 중단이 예정된 경우, 가능한 한 <strong>30일 전</strong>에 서비스 내 공지 또는 가입 이메일을 통해 안내합니다.
            긴급한 사유(보안 위협 등)가 있는 경우 즉시 중단 후 사후 공지할 수 있습니다.
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          약관 변경 시에도 동일한 방법으로 사전 고지하며, 변경 후 계속 서비스를 이용하면 변경된 약관에 동의한 것으로 간주합니다.
        </p>
      </div>
    ),
  },
  {
    id: '6',
    title: '저작권 안내',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">서비스 저작권</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
              TimeFlow 서비스의 디자인, 로고, UI 구성, 소스 코드 등 모든 콘텐츠의 저작권은 서비스 운영자에게 있습니다.
              사용자는 개인적·비상업적 목적 외에 이를 복제·배포·수정·판매할 수 없습니다.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">사용자 데이터 소유권</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
              사용자가 서비스에 입력한 타임테이블, 할 일, 메모 등의 데이터는 사용자 본인에게 소유권이 있습니다.
              운영자는 서비스 제공 목적 이외에 해당 데이터를 사용하지 않습니다.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">오픈소스 라이선스</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
              TimeFlow는 Next.js, Firebase, Tailwind CSS 등 오픈소스 라이브러리를 사용합니다.
              각 라이브러리의 라이선스는 해당 프로젝트의 공식 문서를 따릅니다.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">이용약관</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            최종 업데이트: 2026년 3월 7일
          </p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            TimeFlow 서비스를 이용하시기 전에 본 약관을 주의 깊게 읽어 주세요.
            서비스 이용 시 본 약관에 동의한 것으로 간주합니다.
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

        {/* 개인정보처리방침 링크 */}
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">개인정보처리방침</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">수집하는 정보 및 데이터 처리 방식을 확인하세요.</p>
          </div>
          <Link
            href="/privacy"
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            보기 →
          </Link>
        </div>

        {/* 푸터 */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-4">
          © 2026 TimeFlow. 본 약관은 서비스 변경 시 사전 고지 후 업데이트될 수 있습니다.
        </p>
      </div>
    </div>
  );
}
