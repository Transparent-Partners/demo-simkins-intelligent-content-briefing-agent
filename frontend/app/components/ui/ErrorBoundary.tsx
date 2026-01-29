'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

// ============================================================================
// ERROR BOUNDARY - Catches React errors and displays fallback UI
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler (e.g., for Sentry, LogRocket, etc.)
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys change
    if (this.state.hasError && prevProps.resetKeys !== this.props.resetKeys) {
      const keysChanged = !this.props.resetKeys?.every(
        (key, index) => prevProps.resetKeys?.[index] === key
      );
      if (keysChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ERROR FALLBACK UI
// ============================================================================

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
  title?: string;
  message?: string;
}

export function ErrorFallback({
  error,
  onReset,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again or contact support if the problem persists.',
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[200px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-600/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Title & Message */}
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-6">{message}</p>

        {/* Error Details (dev only) */}
        {isDev && error && (
          <details className="mb-6 text-left">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
              Error details
            </summary>
            <div className="mt-2 p-3 bg-slate-800 rounded-lg overflow-auto max-h-40">
              <p className="text-red-400 text-xs font-mono">
                {error.name}: {error.message}
              </p>
              {error.stack && (
                <pre className="text-slate-500 text-xs mt-2 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          </details>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {onReset && (
            <Button variant="primary" onClick={onReset}>
              Try Again
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION ERROR BOUNDARY - For individual sections
// ============================================================================

interface SectionErrorBoundaryProps {
  children: ReactNode;
  sectionName: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export function SectionErrorBoundary({
  children,
  sectionName,
  onError,
}: SectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        <div className="p-6 bg-slate-900 rounded-xl border border-red-500/30">
          <div className="flex items-center gap-3 text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Error loading {sectionName}</span>
          </div>
          <p className="mt-2 text-slate-400 text-sm">
            This section encountered an error. The rest of the application should still work.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300"
          >
            Reload page to try again
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// ASYNC BOUNDARY - For Suspense + ErrorBoundary combo
// ============================================================================

interface AsyncBoundaryProps {
  children: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export function AsyncBoundary({
  children,
  loading,
  error,
  onError,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={error} onError={onError}>
      {/* Note: Suspense should wrap this in the parent if needed */}
      {children}
    </ErrorBoundary>
  );
}
