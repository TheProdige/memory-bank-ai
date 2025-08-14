/**
 * Global Error Boundary
 * Handles all unhandled React errors with proper logging and fallback UI
 */

import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { config } from '@/core/config/env';
import { Logger } from '@/core/logging/Logger';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  const isDevelopment = config.app.environment === 'development';
  
  const handleReportError = () => {
    // In a real app, this would send to error reporting service
    Logger.error('User reported error', { error: error.message, stack: error.stack });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-full max-w-lg shadow-elegant">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4"
            >
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </motion.div>
            <CardTitle className="text-xl">Une erreur inattendue s'est produite</CardTitle>
            <p className="text-muted-foreground mt-2">
              Nous nous excusons pour ce désagrément. L'erreur a été signalée à notre équipe.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {isDevelopment && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ delay: 0.3 }}
                className="bg-muted p-4 rounded-lg"
              >
                <h4 className="font-medium text-sm mb-2">Détails de l'erreur (dev only):</h4>
                <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                  {error.message}
                </pre>
              </motion.div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={resetErrorBoundary}
                className="flex-1"
                variant="default"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="flex-1"
              >
                <Home className="w-4 h-4 mr-2" />
                Retour à l'accueil
              </Button>
            </div>
            
            <Button 
              onClick={handleReportError}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              <Bug className="w-4 h-4 mr-2" />
              Signaler ce problème
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

const handleError = (error: Error, errorInfo: { componentStack: string }) => {
  Logger.error('React Error Boundary caught an error', {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
  });
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Clear any stale state
        window.location.reload();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};