'use client';

import { LoadingSpinner } from './Button';

// ============================================================================
// LOADING COMPONENTS - Consistent loading states
// ============================================================================

// ============================================================================
// SKELETON LOADER - For content placeholders
// ============================================================================

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animate?: boolean;
}

export function Skeleton({
  width,
  height,
  className = '',
  rounded = 'md',
  animate = true,
}: SkeletonProps) {
  const roundedStyles = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={`
        bg-slate-800 
        ${roundedStyles[rounded]}
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// TEXT SKELETON - For text placeholders
// ============================================================================

interface TextSkeletonProps {
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}

export function TextSkeleton({
  lines = 3,
  lastLineWidth = '60%',
  className = '',
}: TextSkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

// ============================================================================
// CARD SKELETON - For card-like content
// ============================================================================

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-900 rounded-xl border border-slate-800 p-6 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-4 mb-4">
        <Skeleton width={48} height={48} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      <TextSkeleton lines={3} />
    </div>
  );
}

// ============================================================================
// TABLE SKELETON - For table content
// ============================================================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className = '',
}: TableSkeletonProps) {
  return (
    <div
      className={`bg-slate-900 rounded-xl border border-slate-800 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Header */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height={12} width={`${100 / columns - 2}%`} />
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  height={16}
                  width={`${100 / columns - 2}%`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FULL PAGE LOADING - For page-level loading
// ============================================================================

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = 'Loading...' }: FullPageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-blue-500 mb-4" />
        <p className="text-slate-400 text-sm">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// INLINE LOADING - For inline loading states
// ============================================================================

interface InlineLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InlineLoading({
  message,
  size = 'md',
  className = '',
}: InlineLoadingProps) {
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size={size} className="text-blue-500" />
      {message && (
        <span className="text-slate-400 text-sm">{message}</span>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}

// ============================================================================
// OVERLAY LOADING - For loading overlay on content
// ============================================================================

interface OverlayLoadingProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export function OverlayLoading({
  isLoading,
  message,
  children,
}: OverlayLoadingProps) {
  return (
    <div className="relative">
      {children}
      
      {isLoading && (
        <div
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm 
            flex items-center justify-center rounded-inherit z-10"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-blue-500 mb-2" />
            {message && (
              <p className="text-slate-400 text-sm">{message}</p>
            )}
            <span className="sr-only">Loading</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROGRESS BAR - For progress indication
// ============================================================================

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'orange';
  className?: string;
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  color = 'blue',
  className = '',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const sizeStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorStyles = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-sm text-slate-400">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-white font-medium">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-slate-800 rounded-full overflow-hidden ${sizeStyles[size]}`}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorStyles[color]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
