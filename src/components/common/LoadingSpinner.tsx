/**
 * Professional Loading Spinner Component
 * Accessible, animated loading indicator with various sizes and styles
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'skeleton';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const DefaultSpinner: React.FC<{ size: string; className?: string }> = ({ size, className }) => (
  <motion.div
    className={cn('border-2 border-muted border-t-primary rounded-full', size, className)}
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    role="status"
    aria-label="Loading"
  />
);

const DotsSpinner: React.FC<{ size: string; className?: string }> = ({ size, className }) => {
  const dotSize = size === 'w-4 h-4' ? 'w-1 h-1' : size === 'w-6 h-6' ? 'w-1.5 h-1.5' : size === 'w-8 h-8' ? 'w-2 h-2' : 'w-3 h-3';
  
  return (
    <div className={cn('flex space-x-1', className)} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={cn('bg-primary rounded-full', dotSize)}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

const PulseSpinner: React.FC<{ size: string; className?: string }> = ({ size, className }) => (
  <motion.div
    className={cn('bg-primary rounded-full', size, className)}
    animate={{
      scale: [1, 1.1, 1],
      opacity: [0.7, 1, 0.7],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
    role="status"
    aria-label="Loading"
  />
);

const SkeletonSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-3', className)} role="status" aria-label="Loading content">
    <div className="space-y-2">
      <motion.div
        className="h-4 bg-muted rounded w-3/4"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="h-4 bg-muted rounded w-1/2"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />
      <motion.div
        className="h-4 bg-muted rounded w-2/3"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />
    </div>
  </div>
);

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className,
  label = 'Chargement...',
}) => {
  const sizeClass = sizeClasses[size];

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsSpinner size={sizeClass} className={className} />;
      case 'pulse':
        return <PulseSpinner size={sizeClass} className={className} />;
      case 'skeleton':
        return <SkeletonSpinner className={className} />;
      default:
        return <DefaultSpinner size={sizeClass} className={className} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      {renderSpinner()}
      {variant !== 'skeleton' && (
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {label}
        </span>
      )}
    </div>
  );
};

// Overlay loading spinner for full-screen loading
export const LoadingOverlay: React.FC<{
  isVisible: boolean;
  message?: string;
}> = ({ isVisible, message = 'Chargement...' }) => {
  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="bg-card p-6 rounded-lg shadow-elegant border"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <LoadingSpinner size="lg" label={message} />
      </motion.div>
    </motion.div>
  );
};