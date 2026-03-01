'use client';

import { useI18n, type Locale } from '@/lib/i18n';

const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
];

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="relative flex items-center">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="appearance-none text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer pr-5"
        title="Language / 언어 / 言語"
      >
        {LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 text-[9px] text-gray-400">▼</span>
    </div>
  );
}
