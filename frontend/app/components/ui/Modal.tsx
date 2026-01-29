'use client';

import { useEffect, useRef, ReactNode, useCallback, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from './Button';

// ============================================================================
// MODAL COMPONENT - Accessible modal with focus trap
// ============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element and focus the modal
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the modal container after a short delay
      const timer = setTimeout(() => {
        modalRef.current?.focus();
      }, 10);

      return () => clearTimeout(timer);
    } else {
      // Return focus to the previously focused element
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    },
    []
  );

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`
          relative w-full ${sizeStyles[size]}
          bg-slate-900 border border-slate-700 rounded-xl shadow-2xl
          animate-in fade-in zoom-in-95 duration-200
          focus:outline-none
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-white"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-sm text-slate-400"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <IconButton
                icon={<CloseIcon />}
                label="Close modal"
                variant="ghost"
                size="sm"
                onClick={onClose}
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render at document root
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

// ============================================================================
// CONFIRM MODAL - Standard confirmation dialog
// ============================================================================

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
    >
      <div className="text-center">
        <div className={`
          mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4
          ${variant === 'danger' ? 'bg-red-600/20 text-red-400' : ''}
          ${variant === 'warning' ? 'bg-amber-600/20 text-amber-400' : ''}
          ${variant === 'info' ? 'bg-blue-600/20 text-blue-400' : ''}
        `}>
          {variant === 'danger' && <DangerIcon />}
          {variant === 'warning' && <WarningIcon />}
          {variant === 'info' && <InfoIcon />}
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          {title}
        </h3>
        <p className="text-slate-400 text-sm mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// PROMPT MODAL - Accessible replacement for window.prompt()
// ============================================================================

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export function PromptModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder,
  defaultValue = '',
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  loading = false,
}: PromptModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.value = defaultValue;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = () => {
    const value = inputRef.current?.value.trim();
    if (value) {
      onSubmit(value);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg
          text-white placeholder-slate-500 text-sm
          focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </Modal>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DangerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
