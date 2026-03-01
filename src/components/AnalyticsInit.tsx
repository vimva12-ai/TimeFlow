'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getAnalyticsInstance } from '@/lib/firebase/client';
import { analytics } from '@/lib/analytics';

export default function AnalyticsInit() {
  // 최초 마운트: Analytics 초기화
  useEffect(() => {
    getAnalyticsInstance();
  }, []);

  const pathname = usePathname();

  // 라우트 변경마다 page_view 이벤트 전송
  useEffect(() => {
    analytics.pageView(pathname, document.title);
  }, [pathname]);

  return null;
}
