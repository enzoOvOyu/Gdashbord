import { t } from './i18n';
import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './app/router';
import { queryClient } from './app/providers';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div style={{ padding: 32, color: 'var(--rs-text-muted)' }}>{t('common.loading')}</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  );
}
