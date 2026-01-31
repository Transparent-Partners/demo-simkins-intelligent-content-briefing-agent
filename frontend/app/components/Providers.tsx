'use client';

import { ReactNode } from 'react';
import { ToastProvider } from './ui/Toast';
import { ErrorBoundary, ErrorFallback } from './ui/ErrorBoundary';

// ============================================================================
// APP PROVIDERS - Wraps the app with necessary providers
// ============================================================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <ErrorFallback
            error={null}
            title="Application Error"
            message="The application encountered an unexpected error. Please reload the page or contact support."
          />
        </div>
      }
      onError={(error, errorInfo) => {
        // Log to error tracking service in production
        if (process.env.NODE_ENV === 'production') {
          // TODO: Send to Sentry, LogRocket, etc.
          console.error('Application Error:', error, errorInfo);
        }
      }}
    >
      <ToastProvider position="top-right" maxToasts={5}>
        <div className="fixed inset-0 w-screen h-screen overflow-y-auto overflow-x-hidden bg-[#F8FAFC] text-slate-900">
          {children}
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
