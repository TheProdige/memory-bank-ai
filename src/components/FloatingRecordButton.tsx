import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Mic, X } from "lucide-react"
import AudioRecorder from "./AudioRecorder"
import { useUsageLimits } from "@/hooks/useUsageLimits"
import { toast } from "sonner"

interface Props {
  onMemoryCreated?: (memory: any) => void
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showUsageIndicator?: boolean
  pulseOnIdle?: boolean
  quickRecordMode?: boolean
}

export const FloatingRecordButton = ({
  onMemoryCreated,
  position = 'bottom-right',
  showUsageIndicator = true,
  pulseOnIdle = true,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showUsagePopup, setShowUsagePopup] = useState(false)
  const [buttonScale, setButtonScale] = useState(1)
  const hoverTimeout = useRef<number | null>(null)
  const { canCreateMemory, dailyUsed, dailyLimit, subscriptionTier } = useUsageLimits()

  const percent = Math.min(100, Math.round((dailyUsed / Math.max(1, dailyLimit)) * 100))
  const ringColor = percent >= 100 ? 'hsl(var(--destructive))' : 'hsl(var(--accent))'
  const nearLimit = percent >= 80 && percent < 100

  const positionClasses: Record<NonNullable<Props['position']>, string> = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  }

  const usageLabel = `${dailyUsed}/${dailyLimit} utilisés${subscriptionTier === 'free' ? ' (FREE)' : ' (PRO)'}`

  const handleOpenRecorder = useCallback(() => {
    if (!canCreateMemory) {
      setButtonScale(0.9)
      setTimeout(() => setButtonScale(1), 150)
      const msg = subscriptionTier === 'free'
        ? `Limite quotidienne atteinte (${dailyUsed}/${dailyLimit}). Passez en Pro pour 100/jour.`
        : `Limite quotidienne Pro atteinte (${dailyUsed}/${dailyLimit}). Revenez demain !`
      toast.error(msg)
      return
    }
    setIsOpen(true)
  }, [canCreateMemory, dailyUsed, dailyLimit, subscriptionTier])

  const handleMemoryCreated = useCallback((memory: any) => {
    setIsOpen(false)
    setButtonScale(1.2)
    setTimeout(() => setButtonScale(1), 200)
    onMemoryCreated?.(memory)
  }, [onMemoryCreated])

  // Hover delayed popup
  const onMouseEnter = useCallback(() => {
    setIsHovered(true)
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current)
    hoverTimeout.current = window.setTimeout(() => setShowUsagePopup(true), 800)
  }, [])

  const onMouseLeave = useCallback(() => {
    setIsHovered(false)
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current)
    setShowUsagePopup(false)
  }, [])

  // Close on ESC when modal open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  // Modal overlay
  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-sm animate-enter">
        <div className="w-full max-w-2xl relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="absolute -top-12 right-0 text-muted-foreground hover:text-foreground"
            aria-label="Fermer l'enregistreur"
          >
            <X className="w-5 h-5" />
            Fermer
          </Button>
          <AudioRecorder onMemoryCreated={handleMemoryCreated} />
        </div>
      </div>
    )
  }

  const circumference = 2 * Math.PI * 26 // r=26
  const dash = (percent / 100) * circumference

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-40`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Usage popup */}
      {showUsageIndicator && showUsagePopup && (
        <Card 
          className={`w-64 shadow-lg animate-enter absolute ${position.includes('top') ? 'top-16' : '-top-2 -translate-y-full'} ${position.includes('left') ? 'left-0' : 'right-0'}`}
          role="dialog"
          aria-label="Informations d'usage"
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">Enregistrements</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {subscriptionTier === 'pro' ? 'PRO' : 'FREE'}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {percent >= 100 ? 'Limite atteinte' : `${dailyLimit - dailyUsed} enregistrements restants`}
            </div>
            <div className="space-y-1">
              <Progress value={percent} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{usageLabel}</span>
                <span>{percent}%</span>
              </div>
            </div>
            {subscriptionTier === 'free' && (
              <div className="text-xs">
                <Button variant="link" className="px-0 h-auto text-accent">Passer Pro</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Button with progress ring */}
      <button
        onClick={handleOpenRecorder}
        disabled={!canCreateMemory}
        aria-label={`Enregistrer une mémoire — ${usageLabel}`}
        className={`relative h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-gold-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          canCreateMemory ? 'bg-accent text-accent-foreground hover:scale-110' : 'bg-muted text-muted-foreground cursor-not-allowed'
        } ${pulseOnIdle && canCreateMemory && !isHovered ? 'pulse' : ''}`}
        style={{ transform: `scale(${buttonScale})` }}
      >
        {/* Progress ring */}
        {showUsageIndicator && (
          <svg className="absolute -inset-1" width="64" height="64" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
            <circle 
              cx="32" cy="32" r="26" fill="none" 
              stroke={ringColor}
              strokeWidth="4" 
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              className={`${nearLimit ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : ''}`}
            />
          </svg>
        )}
        <Mic className="w-6 h-6" />
        {/* Usage badge */}
        {showUsageIndicator && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-5 text-center shadow">
            {dailyUsed}
          </span>
        )}
      </button>
    </div>
  )
}
