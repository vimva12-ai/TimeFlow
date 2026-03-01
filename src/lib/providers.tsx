'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { I18nProvider } from '@/lib/i18n';
import AnalyticsInit from '@/components/AnalyticsInit';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,       // 30 seconds
            gcTime: 5 * 60 * 1000,      // 5 minutes
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AnalyticsInit />
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
}
