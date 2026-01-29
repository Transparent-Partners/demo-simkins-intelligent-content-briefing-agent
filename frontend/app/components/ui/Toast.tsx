'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TOAST NOTIFICATION SYSTEM - Enterprise-grade notification system
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  // Convenience methods
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// TOAST PROVIDER
// ============================================================================

interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = 'top-right',
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      // Limit max toasts
      return updated.slice(-maxToasts);
    });

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message, duration: 8000 }); // Longer for errors
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && createPortal(
        <ToastContainer toasts={toasts} position={position} onRemove={removeToast} />,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ============================================================================
// USE TOAST HOOK
// ============================================================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// TOAST CONTAINER
// ============================================================================

const positionStyles: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

function ToastContainer({
  toasts,
  position,
  onRemove,
}: {
  toasts: Toast[];
  position: ToastPosition;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className={`fixed z-[100] flex flex-col gap-2 ${positionStyles[position]}`}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// ============================================================================
// TOAST ITEM
// ============================================================================

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duration, toast.id]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  const typeStyles: Record<ToastType, { bg: string; border: string; icon: ReactNode }> = {
    success: {
      bg: 'bg-green-900/90',
      border: 'border-green-700',
      icon: <SuccessIcon />,
    },
    error: {
      bg: 'bg-red-900/90',
      border: 'border-red-700',
      icon: <ErrorIcon />,
    },
    warning: {
      bg: 'bg-amber-900/90',
      border: 'border-amber-700',
      icon: <WarningIcon />,
    },
    info: {
      bg: 'bg-blue-900/90',
      border: 'border-blue-700',
      icon: <InfoIcon />,
    },
  };

  const style = typeStyles[toast.type];

  return (
    <div
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`
        w-80 p-4 rounded-lg border backdrop-blur-sm shadow-lg
        ${style.bg} ${style.border}
        ${isExiting ? 'animate-out fade-out slide-out-to-right duration-200' : 'animate-in fade-in slide-in-from-right duration-200'}
      `}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">{toast.title}</p>
          {toast.message && (
            <p className="text-slate-300 text-sm mt-1">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleClose();
              }}
              className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 text-slate-400 hover:text-white rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function SuccessIcon() {
  return (
    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
