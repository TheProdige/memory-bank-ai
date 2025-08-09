import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import { useUsageLimits } from '@/hooks/useUsageLimits'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
  fallbackPath?: string
  minimalLoading?: boolean
  showRetryButton?: boolean
  customLoadingComponent?: React.ReactNode
  onAuthRequired?: (location: Location) => void
  redirectDelay?: number
}

const checkPermissions = (
  userRoles: string[] = [],
  requiredRoles?: string[],
  subscriptionTier?: string
) => {
  if (!requiredRoles || requiredRoles.length === 0) return true
  const hasRole = requiredRoles.some((r) => userRoles.includes(r))
  const needsPro = requiredRoles.includes('pro')
  const hasPro = subscriptionTier?.toLowerCase() === 'pro'
  return hasRole && (needsPro ? hasPro : true)
}

export const ProtectedRoute = ({
  children,
  requiredRoles,
  fallbackPath = '/auth',
  minimalLoading = false,
  showRetryButton = true,
  customLoadingComponent,
  onAuthRequired,
  redirectDelay,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth()
  const { subscriptionTier } = useUsageLimits()
  const location = useLocation()

  const [authError, setAuthError] = useState<null | { code?: string; message: string }>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const userRoles = useMemo(() => (user?.user_metadata?.roles as string[]) || [], [user])
  const allowed = useMemo(() => checkPermissions(userRoles, requiredRoles, subscriptionTier), [userRoles, requiredRoles, subscriptionTier])

  useEffect(() => {
    if (!loading && !user) {
      onAuthRequired?.(location as unknown as Location)
      if (redirectDelay && redirectDelay > 0) {
        setCountdown(Math.ceil(redirectDelay / 1000))
      }
    }
  }, [loading, user, redirectDelay, location, onAuthRequired])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => (c ? c - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const retryAuth = useCallback(async () => {
    if (retryCount >= 3) return
    setIsRetrying(true)
    try {
      // Placeholder retry logic (could re-trigger a session check)
      await new Promise((res) => setTimeout(res, 600))
      setAuthError(null)
    } catch (e) {
      setAuthError({ message: 'Impossible de vérifier la session.' })
    } finally {
      setIsRetrying(false)
      setRetryCount((x) => x + 1)
    }
  }, [retryCount])

  if (loading) {
    if (customLoadingComponent) return <>{customLoadingComponent}</>
    if (minimalLoading)
      return (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute top-0 left-0 right-0">
            <Progress value={undefined} className="h-1" />
          </div>
          <div className="absolute top-4 right-4">
            <div className="h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        </div>
      )

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent/30 border-t-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification de votre session…</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    if (redirectDelay && countdown && countdown > 0) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center space-y-4">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold">Authentification requise</h2>
              <p className="text-sm text-muted-foreground">
                Redirection vers la page d’authentification dans {countdown} seconde{countdown > 1 ? 's' : ''}…
              </p>
              {showRetryButton && (
                <Button variant="outline" onClick={retryAuth} disabled={isRetrying}>
                  {isRetrying ? 'Nouvelle tentative…' : 'Réessayer'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }
    return <Navigate to={fallbackPath} state={{ from: location }} replace />
  }

  // Authenticated but not authorized
  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full animate-[shake_300ms_ease-in-out]">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Accès restreint</h2>
            <p className="text-sm text-muted-foreground">Vous n’avez pas les permissions requises pour accéder à cette page.</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => window.history.back()}>Retour</Button>
              <Button onClick={() => (window.location.href = '/')}>Accueil</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}