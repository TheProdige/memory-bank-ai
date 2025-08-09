import { useMemo, useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Play,
  Pause,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  Volume2,
  Star,
  EyeOff,
  Globe,
  Copy,
  Share,
  Download,
  RotateCcw,
  ExternalLink,
  Activity,
  Brain,
  Smile,
  Frown,
  Meh,
  Zap,
  Heart,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from '@/hooks/use-toast'

export interface MemoryCardProps {
  memory: {
    id: string
    title: string
    transcript: string
    summary?: string
    emotion?: string
    sentiment_score?: number
    confidence?: number
    tags?: string[]
    audio_url?: string
    duration?: number
    file_size?: number
    language?: string
    created_at: string
    updated_at?: string
    is_favorite?: boolean
    is_private?: boolean
    play_count?: number
    quality_score?: number
  }
  onPlay?: (id: string) => void
  onPause?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onShare?: (id: string) => void
  onDownload?: (id: string) => void
  onToggleFavorite?: (id: string, next: boolean) => void
  onTogglePrivate?: (id: string, next: boolean) => void
  onCopyTranscript?: (id: string) => void
  isPlaying?: boolean
  audioProgress?: number // 0-100
  currentTime?: number // seconds
  compact?: boolean
  showStats?: boolean
  interactive?: boolean
}

// Utils
const pad = (n: number) => n.toString().padStart(2, '0')
const formatDuration = (seconds = 0) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${pad(m)}:${pad(s)}`
}
const formatFileSize = (bytes = 0) => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
const getQualityTone = (score = 0) => {
  if (score >= 0.8) return 'accent'
  if (score >= 0.6) return 'primary'
  return 'destructive'
}
const qualityBarClass = (score = 0) => {
  const tone = getQualityTone(score)
  if (tone === 'accent') return 'from-accent to-accent'
  if (tone === 'primary') return 'from-primary to-primary'
  return 'from-destructive to-destructive'
}

const getEmotionConfig = (emotion?: string, sentiment?: number) => {
  const e = (emotion || '').toLowerCase()
  const base = { label: emotion || 'Inconnu', score: sentiment }
  if (/joyeux|heureux|content/.test(e))
    return { ...base, Icon: Smile, bg: 'bg-accent/10', text: 'text-accent' }
  if (/triste|mélancolique|melancolique/.test(e))
    return { ...base, Icon: Frown, bg: 'bg-destructive/10', text: 'text-destructive' }
  if (/neutre|calme/.test(e))
    return { ...base, Icon: Meh, bg: 'bg-secondary', text: 'text-muted-foreground' }
  if (/passionné|enthousiaste|passionne|enthousiaste/.test(e))
    return { ...base, Icon: Heart, bg: 'bg-primary/10', text: 'text-primary' }
  if (/énergique|dynamique|energique/.test(e))
    return { ...base, Icon: Zap, bg: 'bg-primary/10', text: 'text-primary' }
  return { ...base, Icon: Brain, bg: 'bg-accent/10', text: 'text-accent' }
}

export const MemoryCard = ({
  memory,
  onPlay,
  onPause,
  onEdit,
  onDelete,
  onShare,
  onDownload,
  onToggleFavorite,
  onTogglePrivate,
  onCopyTranscript,
  isPlaying = false,
  audioProgress = 0,
  currentTime = 0,
  compact = false,
  showStats = false,
  interactive = true,
}: MemoryCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showFullDate, setShowFullDate] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const relDate = useMemo(
    () =>
      formatDistanceToNow(new Date(memory.created_at), {
        addSuffix: true,
        locale: fr,
      }),
    [memory.created_at]
  )
  const absDate = useMemo(() => new Date(memory.created_at).toLocaleString('fr-FR'), [memory.created_at])

  const truncatedTranscript = useMemo(() => {
    const t = memory.transcript || ''
    return t.length > 150 ? t.slice(0, 150) + '…' : t
  }, [memory.transcript])

  const qualityTone = getQualityTone(memory.quality_score || 0)
  const emotionCfg = getEmotionConfig(memory.emotion, memory.sentiment_score)

  const handleAudioToggle = useCallback(() => {
    if (!memory.audio_url) return
    if (isPlaying) onPause?.(memory.id)
    else onPlay?.(memory.id)
  }, [isPlaying, memory.id, memory.audio_url, onPause, onPlay])

  const handleCopyTranscript = useCallback(async () => {
    if (!memory.transcript) return
    try {
      await navigator.clipboard?.writeText(memory.transcript)
      toast({ title: 'Transcription copiée', description: 'Le texte a été copié dans le presse-papiers.' })
      onCopyTranscript?.(memory.id)
    } catch {
      toast({ title: 'Copie impossible', description: 'Veuillez réessayer.', variant: 'destructive' as any })
    }
  }, [memory.transcript, memory.id, onCopyTranscript])

  const cardCls = [
    'transition-all duration-300 border-border/50',
    interactive ? 'hover:shadow-lg hover:shadow-accent/10 hover:scale-[1.01]' : '',
    memory.is_favorite ? 'ring-1 ring-accent/30' : '',
    memory.is_private ? 'opacity-95' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Header badges
  const LangBadge = memory.language ? (
    <Badge variant="outline" className="uppercase text-[10px]">
      {memory.language}
    </Badge>
  ) : null

  const FavButton = (
    <Button
      aria-label={memory.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${memory.is_favorite ? 'text-accent' : 'text-muted-foreground'}`}
      onClick={() => onToggleFavorite?.(memory.id, !memory.is_favorite)}
    >
      <Star className={memory.is_favorite ? 'fill-current' : ''} />
    </Button>
  )

  const PrivateButton = (
    <Button
      aria-label={memory.is_private ? 'Rendre public' : 'Rendre privé'}
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${memory.is_private ? 'text-destructive' : 'text-muted-foreground'}`}
      onClick={() => onTogglePrivate?.(memory.id, !memory.is_private)}
    >
      <EyeOff />
    </Button>
  )

  const TopStatusBar = (
    <div className={`h-1 w-full bg-gradient-to-r ${qualityBarClass(memory.quality_score || 0)} rounded-t-lg`} />
  )

  const Header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-lg leading-tight truncate">{memory.title}</h3>
          {LangBadge}
          {memory.play_count && memory.play_count > 0 ? (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> {memory.play_count}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <button
            className="inline-flex items-center gap-1 hover:underline"
            onDoubleClick={() => setShowFullDate((v) => !v)}
            title="Double-clic pour basculer le format"
          >
            <Calendar className="w-3 h-3" />
            <span>{showFullDate ? absDate : relDate}</span>
          </button>
          <div className={`inline-flex items-center gap-1 ${emotionCfg.text} ${emotionCfg.bg} px-2 py-0.5 rounded-full text-xs`}>
            <emotionCfg.Icon className="w-3 h-3" />
            <span className="capitalize">
              {emotionCfg.label}
              {typeof memory.sentiment_score === 'number' && ` • ${(memory.sentiment_score * 100).toFixed(0)}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {FavButton}
        {PrivateButton}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Actions">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(memory.id)}>
                <Edit className="w-4 h-4 mr-2" /> Modifier
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleCopyTranscript}>
              <Copy className="w-4 h-4 mr-2" /> Copier la transcription
            </DropdownMenuItem>
            {onShare && (
              <DropdownMenuItem onClick={() => onShare(memory.id)}>
                <Share className="w-4 h-4 mr-2" /> Partager
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem onClick={() => onDownload(memory.id)}>
                <Download className="w-4 h-4 mr-2" /> Télécharger
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onToggleFavorite && (
              <DropdownMenuItem onClick={() => onToggleFavorite(memory.id, !memory.is_favorite)}>
                <Star className="w-4 h-4 mr-2" /> {memory.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </DropdownMenuItem>
            )}
            {onTogglePrivate && (
              <DropdownMenuItem onClick={() => onTogglePrivate(memory.id, !memory.is_private)}>
                <EyeOff className="w-4 h-4 mr-2" /> {memory.is_private ? 'Rendre public' : 'Rendre privé'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDelete && (
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(memory.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Supprimer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  const AudioSection = (
    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAudioToggle}
          className="h-9 w-9 p-0 rounded-full bg-accent/10 hover:bg-accent/20"
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? <Pause className="w-4 h-4 text-accent" /> : <Play className="w-4 h-4 text-accent" />}
        </Button>
        <div className="min-w-0 flex-1">
          <Progress value={audioProgress} className="h-2 transition-all duration-500" />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatDuration(currentTime)} / {formatDuration(memory.duration || 0)}
            </span>
            {typeof memory.file_size === 'number' && <span>{formatFileSize(memory.file_size)}</span>}
          </div>
        </div>
        <div className={`ml-2 inline-flex items-center gap-1 text-xs ${qualityTone === 'destructive' ? 'text-destructive' : qualityTone === 'primary' ? 'text-primary' : 'text-accent'}`}>
          <Activity className="w-3 h-3" />
          {(Math.round((memory.quality_score || 0) * 100)) || 0}%
        </div>
      </div>
    </div>
  )

  const SummarySection = memory.summary ? (
    <div className="mt-4 relative p-3 bg-accent/5 rounded-lg border-l-4 border-accent">
      <div className="absolute right-3 top-3 w-2 h-2 rounded-full bg-accent/20" />
      <div className="flex items-center gap-2 mb-1 text-sm font-medium">
        <Brain className="w-4 h-4 text-accent" /> Résumé intelligent
        {typeof memory.confidence === 'number' && (
          <Badge variant="secondary" className="ml-2 text-[10px]">Confiance {(memory.confidence * 100).toFixed(0)}%</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{memory.summary}</p>
    </div>
  ) : null

  const TranscriptSection = (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Transcription</p>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleCopyTranscript}>
          <Copy className="w-4 h-4 mr-1" /> Copier
        </Button>
      </div>
      <div className="relative">
        <p className={`text-sm text-muted-foreground leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
          {isExpanded ? memory.transcript : truncatedTranscript}
        </p>
        {!isExpanded && memory.transcript && memory.transcript.length > 150 && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {memory.transcript && memory.transcript.length > 150 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded((v) => !v)}
          className="mt-2 h-auto px-2 text-accent hover:text-accent/80"
        >
          {isExpanded ? (
            <span className="inline-flex items-center gap-1"><RotateCcw className="w-4 h-4" /> Voir moins</span>
          ) : (
            <span className="inline-flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Voir plus</span>
          )}
        </Button>
      )}
    </div>
  )

  const TagsSection = memory.tags && memory.tags.length > 0 ? (
    <div className="mt-4">
      <p className="text-sm font-medium mb-2">Tags</p>
      <div className="flex flex-wrap gap-2">
        {memory.tags.map((tag, idx) => (
          <Badge key={`${tag}-${idx}`} variant="secondary" className="cursor-pointer bg-accent/10 hover:bg-accent/20 text-accent border-accent/20">
            #{tag}
          </Badge>
        ))}
      </div>
    </div>
  ) : null

  const FooterStats = showStats ? (
    <CardFooter className="mt-4 border-t border-border/30 pt-3 text-xs text-muted-foreground flex items-center justify-between">
      <span>Maj {memory.updated_at ? new Date(memory.updated_at).toLocaleDateString('fr-FR') : '—'} • ID {memory.id.slice(0, 8)}</span>
      <span className={`${qualityTone === 'destructive' ? 'text-destructive' : qualityTone === 'primary' ? 'text-primary' : 'text-accent'}`}>
        Qualité {(Math.round((memory.quality_score || 0) * 100)) || 0}%
      </span>
    </CardFooter>
  ) : null

  if (compact) {
    return (
      <Card
        ref={cardRef}
        className={cardCls}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {TopStatusBar}
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAudioToggle}
              className="h-10 w-10 p-0 rounded-full bg-accent/10 hover:bg-accent/20"
            >
              {isPlaying ? <Pause className="w-5 h-5 text-accent" /> : <Play className="w-5 h-5 text-accent" />}
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium truncate">{memory.title}</h4>
                {LangBadge}
              </div>
              <p className="text-sm text-muted-foreground truncate">{truncatedTranscript}</p>
              {typeof audioProgress === 'number' && (
                <div className="mt-2">
                  <Progress value={audioProgress} className="h-1" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {FavButton}
              {PrivateButton}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      ref={cardRef}
      className={cardCls}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {TopStatusBar}
      <CardHeader className="pb-3">{Header}</CardHeader>
      <CardContent className="pt-0">
        {memory.audio_url ? AudioSection : null}
        {SummarySection}
        {TranscriptSection}
        {TagsSection}
      </CardContent>
      {FooterStats}
    </Card>
  )
}