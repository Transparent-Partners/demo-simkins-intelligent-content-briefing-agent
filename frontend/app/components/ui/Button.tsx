'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

// ============================================================================
// BUTTON COMPONENT - Enterprise-grade button with variants
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonRole = 'creative' | 'production' | 'media' | 'default';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  role?: ButtonRole;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-blue-600 text-white 
    hover:bg-blue-700 
    focus:ring-blue-500
    disabled:bg-blue-400
  `,
  secondary: `
    bg-slate-700 text-white 
    hover:bg-slate-600 
    focus:ring-slate-500
    disabled:bg-slate-500
  `,
  danger: `
    bg-red-600 text-white 
    hover:bg-red-700 
    focus:ring-red-500
    disabled:bg-red-400
  `,
  ghost: `
    bg-transparent text-slate-400 
    hover:bg-slate-800 hover:text-white 
    focus:ring-slate-500
  `,
  outline: `
    bg-transparent text-slate-300 
    border border-slate-600 
    hover:bg-slate-800 hover:border-slate-500 
    focus:ring-slate-500
  `,
};

const roleStyles: Record<ButtonRole, string> = {
  creative: `
    bg-purple-600 text-white 
    hover:bg-purple-700 
    focus:ring-purple-500
    disabled:bg-purple-400
  `,
  production: `
    bg-orange-600 text-white 
    hover:bg-orange-700 
    focus:ring-orange-500
    disabled:bg-orange-400
  `,
  media: `
    bg-green-600 text-white 
    hover:bg-green-700 
    focus:ring-green-500
    disabled:bg-green-400
  `,
  default: '',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      role = 'default',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    
    // Use role style if specified, otherwise use variant
    const colorStyle = role !== 'default' ? roleStyles[role] : variantStyles[variant];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium rounded-lg
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
          disabled:cursor-not-allowed disabled:opacity-60
          ${sizeStyles[size]}
          ${colorStyle}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <LoadingSpinner size={size === 'sm' ? 'xs' : 'sm'} />
        )}
        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
        <span>{children}</span>
        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ============================================================================
// ICON BUTTON - For icon-only buttons with accessibility
// ============================================================================

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // Required for accessibility
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = 'ghost',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    
    const sizeClass = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3',
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          rounded-lg
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
          disabled:cursor-not-allowed disabled:opacity-60
          ${variantStyles[variant]}
          ${sizeClass[size]}
          ${className}
        `}
        aria-label={label}
        aria-busy={loading}
        aria-disabled={isDisabled}
        title={label}
        {...props}
      >
        {loading ? <LoadingSpinner size="sm" /> : icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

// ============================================================================
// LOADING SPINNER
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClass = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <svg
      className={`animate-spin ${sizeClass[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
