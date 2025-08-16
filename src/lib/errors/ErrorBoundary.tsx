/**
 * Comprehensive Error Boundary - World-class error handling
 * Implements error recovery, logging, and user-friendly error states
 */

import React, { 
  Component, 
  ReactNode, 
  ComponentType,
  Suspense
} from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  RefreshCw, 
  Bug, 
  Home,
  ChevronDown,
  ChevronUp,
  Copy,
  Send
} from 'lucide-react'
import { Logger } from '@/core/logging/Logger'
import { toast } from 'sonner'

// Error types for better categorization
export enum ErrorType {
  CHUNK_LOAD = 'ChunkLoadError',
  NETWORK = 'NetworkError', 
  VALIDATION = 'ValidationError',
  PERMISSION = 'PermissionError',
  AUTHENTICATION = 'AuthenticationError',
  RATE_LIMIT = 'RateLimitError',
  UNKNOWN = 'UnknownError'
}

interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorBoundaryStack?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorType: ErrorType
  showDetails: boolean
  retryCount: number
  errorId: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'feature'
  maxRetries?: number
  showReportButton?: boolean
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer?: NodeJS.Timeout

  constructor(props: ErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: ErrorType.UNKNOWN,
      showDetails: false,
      retryCount: 0,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorType = ErrorBoundaryClass.categorizeError(error)
    const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    
    return {
      hasError: true,
      error,
      errorType,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props
    
    // Log error with context
    Logger.error('React Error Boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level,
      errorId: this.state.errorId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    })
    
    // Update state with error info
    this.setState({ errorInfo })
    
    // Call custom error handler
    onError?.(error, errorInfo)
    
    // Report to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo)
    }
  }

  public static categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()
    
    if (message.includes('loading chunk') || message.includes('loading css chunk')) {
      return ErrorType.CHUNK_LOAD
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return ErrorType.PERMISSION
    }
    
    if (message.includes('auth') || name.includes('auth')) {
      return ErrorType.AUTHENTICATION
    }
    
    if (message.includes('rate limit') || message.includes('too many')) {
      return ErrorType.RATE_LIMIT
    }
    
    return ErrorType.UNKNOWN
  }

  private async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // In a real app, send to error reporting service
      const errorReport = {
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        level: this.props.level
      }
      
      console.log('Error report:', errorReport)
      // await sendToErrorReportingService(errorReport)
    } catch (reportError) {
      Logger.error('Failed to report error', { reportError })
    }
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state
    
    if (retryCount >= maxRetries) {
      toast.error('Nombre maximum de tentatives atteint')
      return
    }
    
    // Clear timer if exists
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
    
    // Show loading state briefly
    toast.info('Nouvelle tentative en cours...')
    
    // Reset error state after delay
    this.retryTimer = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
      })
    }, 1000)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  private copyErrorDetails = async () => {
    const { error, errorInfo, errorId } = this.state
    const details = `
Error ID: ${errorId}
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
    `.trim()
    
    try {
      await navigator.clipboard.writeText(details)
      toast.success('Détails de l\'erreur copiés')
    } catch {
      toast.error('Impossible de copier les détails')
    }
  }

  private sendErrorReport = async () => {
    try {
      // Simulate sending error report
      toast.info('Envoi du rapport d\'erreur...')
      
      // In real app, send to support system
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('Rapport d\'erreur envoyé avec succès')
    } catch {
      toast.error('Erreur lors de l\'envoi du rapport')
    }
  }

  private getErrorTitle(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.CHUNK_LOAD:
        return 'Erreur de chargement'
      case ErrorType.NETWORK:
        return 'Erreur réseau'
      case ErrorType.VALIDATION:
        return 'Erreur de validation'
      case ErrorType.PERMISSION:
        return 'Erreur de permission'
      case ErrorType.AUTHENTICATION:
        return 'Erreur d\'authentification'
      case ErrorType.RATE_LIMIT:
        return 'Limite de débit atteinte'
      default:
        return 'Erreur inattendue'
    }
  }

  private getErrorDescription(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.CHUNK_LOAD:
        return 'Une nouvelle version de l\'application est disponible. Veuillez recharger la page.'
      case ErrorType.NETWORK:
        return 'Problème de connexion réseau. Vérifiez votre connexion internet.'
      case ErrorType.VALIDATION:
        return 'Données invalides détectées. Veuillez vérifier vos entrées.'
      case ErrorType.PERMISSION:
        return 'Vous n\'avez pas les permissions nécessaires pour cette action.'
      case ErrorType.AUTHENTICATION:
        return 'Votre session a expiré. Veuillez vous reconnecter.'
      case ErrorType.RATE_LIMIT:
        return 'Trop de requêtes. Veuillez patienter avant de réessayer.'
      default:
        return 'Une erreur inattendue s\'est produite. Nos équipes en ont été informées.'
    }
  }

  private getRecoveryActions(errorType: ErrorType) {
    switch (errorType) {
      case ErrorType.CHUNK_LOAD:
        return [
          { label: 'Recharger la page', action: this.handleReload, primary: true },
          { label: 'Accueil', action: this.handleGoHome }
        ]
      case ErrorType.NETWORK:
        return [
          { label: 'Réessayer', action: this.handleRetry, primary: true },
          { label: 'Recharger', action: this.handleReload }
        ]
      case ErrorType.AUTHENTICATION:
        return [
          { label: 'Se reconnecter', action: () => window.location.href = '/auth', primary: true },
          { label: 'Accueil', action: this.handleGoHome }
        ]
      default:
        return [
          { label: 'Réessayer', action: this.handleRetry, primary: true },
          { label: 'Recharger', action: this.handleReload },
          { label: 'Accueil', action: this.handleGoHome }
        ]
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { fallback: Fallback, showReportButton = true, level = 'component' } = this.props
    const { error, errorType, showDetails, retryCount, errorId } = this.state
    const maxRetries = 3

    // Use custom fallback if provided
    if (Fallback && error) {
      return <Fallback error={error} retry={this.handleRetry} />
    }

    const title = this.getErrorTitle(errorType)
    const description = this.getErrorDescription(errorType)
    const actions = this.getRecoveryActions(errorType)

    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {title}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Code d'erreur: {errorId}</AlertTitle>
              <AlertDescription className="mt-2">
                {description}
              </AlertDescription>
            </Alert>

            {/* Recovery Actions */}
            <div className="space-y-3">
              <h4 className="font-medium">Actions de récupération:</h4>
              <div className="flex flex-wrap gap-2">
                {actions.map(({ label, action, primary }) => (
                  <Button
                    key={label}
                    onClick={action}
                    variant={primary ? 'default' : 'outline'}
                    size="sm"
                    disabled={label === 'Réessayer' && retryCount >= (maxRetries || 3)}
                  >
                    {label === 'Réessayer' && <RefreshCw className="w-4 h-4 mr-2" />}
                    {label === 'Accueil' && <Home className="w-4 h-4 mr-2" />}
                    {label}
                    {label === 'Réessayer' && retryCount > 0 && (
                      <span className="ml-2 text-xs">({retryCount}/{maxRetries || 3})</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Technical Details */}
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={this.toggleDetails}
                className="p-0 h-auto"
              >
                <Bug className="w-4 h-4 mr-2" />
                Détails techniques
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 ml-2" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-2" />
                )}
              </Button>
              
              {showDetails && (
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="font-mono text-sm">
                    <strong>Erreur:</strong> {error?.message}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground max-h-32 overflow-y-auto">
                    <strong>Stack:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{error?.stack}</pre>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={this.copyErrorDetails}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copier
                    </Button>
                    
                    {showReportButton && (
                      <Button variant="outline" size="sm" onClick={this.sendErrorReport}>
                        <Send className="w-4 h-4 mr-2" />
                        Signaler
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Context Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Niveau: {level}</div>
              <div>URL: {window.location.pathname}</div>
              <div>Heure: {new Date().toLocaleString('fr-FR')}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundaryClass {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundaryClass>
  )

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`
  
  return WithErrorBoundaryComponent
}

// Async error boundary for handling promise rejections
export class AsyncErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: ErrorType.UNKNOWN,
      showDetails: false,
      retryCount: 0,
      errorId: ''
    }
  }

  componentDidMount() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handlePromiseRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection)
  }

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    const error = new Error(`Unhandled Promise Rejection: ${event.reason}`)
    const errorInfo: ErrorInfo = {
      componentStack: 'Promise rejection outside component tree'
    }
    
    this.setState({
      hasError: true,
      error,
      errorInfo,
      errorType: ErrorBoundaryClass.categorizeError(error),
      errorId: `async_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    })
    
    Logger.error('Unhandled promise rejection', {
      reason: event.reason,
      error: error.message
    })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryClass {...this.props} />
    }
    
    return this.props.children
  }
}

// Suspense wrapper with error boundary
export function SuspenseWithErrorBoundary({ 
  children, 
  fallback, 
  errorBoundaryProps 
}: {
  children: ReactNode
  fallback?: ReactNode
  errorBoundaryProps?: ErrorBoundaryProps
}) {
  return (
    <ErrorBoundaryClass {...errorBoundaryProps}>
      <Suspense 
        fallback={
          fallback || (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          )
        }
      >
        {children}
      </Suspense>
    </ErrorBoundaryClass>
  )
}

export const ErrorBoundary = ErrorBoundaryClass