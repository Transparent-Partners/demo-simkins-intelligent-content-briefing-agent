'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState, useId } from 'react';

// ============================================================================
// INPUT COMPONENT - Enterprise-grade form input with validation
// ============================================================================

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'filled';

interface BaseInputProps {
  label?: string;
  description?: string;
  error?: string;
  warning?: string;
  required?: boolean;
  size?: InputSize;
  variant?: InputVariant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, BaseInputProps {}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {}

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
};

const variantStyles: Record<InputVariant, string> = {
  default: 'bg-slate-800 border-slate-700',
  filled: 'bg-slate-900 border-slate-800',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      error,
      warning,
      required,
      size = 'md',
      variant = 'default',
      leftIcon,
      rightIcon,
      className = '',
      id: providedId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;

    const hasError = !!error;
    const hasWarning = !!warning && !hasError;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-white mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-400 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        {description && (
          <p
            id={descriptionId}
            className="text-xs text-slate-400 mb-2"
          >
            {description}
          </p>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-required={required}
            aria-invalid={hasError}
            aria-describedby={
              [description && descriptionId, (error || warning) && errorId]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={`
              w-full rounded-lg border
              text-white placeholder-slate-500
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900
              disabled:opacity-50 disabled:cursor-not-allowed
              ${sizeStyles[size]}
              ${variantStyles[variant]}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${hasError 
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                : hasWarning
                  ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500'
                  : 'focus:border-blue-500 focus:ring-blue-500'
              }
              ${className}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {(error || warning) && (
          <p
            id={errorId}
            className={`mt-1.5 text-xs flex items-center gap-1.5 ${
              hasError ? 'text-red-400' : 'text-amber-400'
            }`}
            role={hasError ? 'alert' : undefined}
          >
            {hasError ? <ErrorIcon /> : <WarningIcon />}
            {error || warning}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      error,
      warning,
      required,
      size = 'md',
      variant = 'default',
      className = '',
      id: providedId,
      disabled,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;

    const hasError = !!error;
    const hasWarning = !!warning && !hasError;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-white mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-400 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        {description && (
          <p
            id={descriptionId}
            className="text-xs text-slate-400 mb-2"
          >
            {description}
          </p>
        )}

        <textarea
          ref={ref}
          id={id}
          rows={rows}
          disabled={disabled}
          aria-required={required}
          aria-invalid={hasError}
          aria-describedby={
            [description && descriptionId, (error || warning) && errorId]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={`
            w-full rounded-lg border resize-none
            text-white placeholder-slate-500
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed
            ${sizeStyles[size]}
            ${variantStyles[variant]}
            ${hasError 
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
              : hasWarning
                ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500'
                : 'focus:border-blue-500 focus:ring-blue-500'
            }
            ${className}
          `}
          {...props}
        />

        {(error || warning) && (
          <p
            id={errorId}
            className={`mt-1.5 text-xs flex items-center gap-1.5 ${
              hasError ? 'text-red-400' : 'text-amber-400'
            }`}
            role={hasError ? 'alert' : undefined}
          >
            {hasError ? <ErrorIcon /> : <WarningIcon />}
            {error || warning}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// ============================================================================
// SELECT COMPONENT
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<InputHTMLAttributes<HTMLSelectElement>, 'size'>, BaseInputProps {
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      description,
      error,
      warning,
      required,
      size = 'md',
      variant = 'default',
      options,
      placeholder,
      className = '',
      id: providedId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;

    const hasError = !!error;
    const hasWarning = !!warning && !hasError;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-white mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-400 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        {description && (
          <p
            id={descriptionId}
            className="text-xs text-slate-400 mb-2"
          >
            {description}
          </p>
        )}

        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-required={required}
          aria-invalid={hasError}
          aria-describedby={
            [description && descriptionId, (error || warning) && errorId]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={`
            w-full rounded-lg border appearance-none
            text-white
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed
            ${sizeStyles[size]}
            ${variantStyles[variant]}
            ${hasError 
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
              : hasWarning
                ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500'
                : 'focus:border-blue-500 focus:ring-blue-500'
            }
            ${className}
          `}
          {...(props as any)}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {(error || warning) && (
          <p
            id={errorId}
            className={`mt-1.5 text-xs flex items-center gap-1.5 ${
              hasError ? 'text-red-400' : 'text-amber-400'
            }`}
            role={hasError ? 'alert' : undefined}
          >
            {hasError ? <ErrorIcon /> : <WarningIcon />}
            {error || warning}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================================================
// ICONS
// ============================================================================

function ErrorIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
