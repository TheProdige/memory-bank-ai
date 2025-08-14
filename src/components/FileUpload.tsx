import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Upload, X, FileAudio, AlertTriangle, Play, Pause, Clock, Volume2 } from "lucide-react"

interface FileUploadProps {
  onFileSelected: (file: File, audioUrl: string, metadata?: AudioMetadata) => void
  acceptedFormats?: string[]
  maxSize?: number // in MB
  maxDuration?: number // in seconds
  disabled?: boolean
  allowPreview?: boolean
  multipleFiles?: boolean
}

interface AudioMetadata {
  duration: number
  size: number
  type: string
  name: string
  isValid: boolean
}

interface AudioFile {
  file: File
  url: string
  metadata: AudioMetadata
  id: string
}

export const FileUpload = ({ 
  onFileSelected, 
  acceptedFormats = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.mp3', '.wav', '.m4a', '.mp4', '.webm'],
  maxSize = 50,
  maxDuration = 600, // 10 minutes
  disabled = false,
  allowPreview = true,
  multipleFiles = false
}: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  // Cleanup URLs & audio elements
  useEffect(() => {
    return () => {
      audioFiles.forEach(({ url }) => URL.revokeObjectURL(url))
      audioRefs.current.forEach(audio => {
        audio.pause()
        audio.src = ''
      })
    }
  }, [])

  // Debounced drag handlers
  const debouncedDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }, [disabled])

  const debouncedDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX: x, clientY: y } = e
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const validateFile = (file: File): string | null => {
    const isValidType = file.type.startsWith('audio/') || 
                       file.type.startsWith('video/') ||
                       file.type.startsWith('image/') ||
                       file.type === 'application/pdf' ||
                       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       file.type === 'text/plain'
                       
    const hasValidExtension = acceptedFormats.some(format => 
      file.name.toLowerCase().endsWith(format.toLowerCase())
    )

    if (!isValidType && !hasValidExtension) {
      return `Format non supporté. Formats acceptés: ${acceptedFormats.join(', ')}`
    }

    const sizeInMB = file.size / (1024 * 1024)
    if (sizeInMB > maxSize) {
      return `Fichier trop volumineux. Taille maximum: ${maxSize}MB (actuel: ${sizeInMB.toFixed(1)}MB)`
    }

    return null
  }

  const validateAudioFile = async (file: File): Promise<{ isValid: boolean; duration: number; error?: string }> => {
    return new Promise((resolve) => {
      const audio = new Audio()
      const url = URL.createObjectURL(file)
      
      const cleanup = () => {
        URL.revokeObjectURL(url)
        audio.removeEventListener('loadedmetadata', onLoad)
        audio.removeEventListener('error', onError)
      }

      const onLoad = () => {
        const duration = audio.duration
        cleanup()
        
        if (!duration || duration <= 0) {
          resolve({ isValid: false, duration: 0, error: "Fichier audio invalide ou corrompu" })
        } else if (duration > maxDuration) {
          resolve({ 
            isValid: false, 
            duration, 
            error: `Durée trop longue. Maximum: ${Math.floor(maxDuration/60)}:${(maxDuration%60).toString().padStart(2, '0')} (actuel: ${Math.floor(duration/60)}:${Math.floor(duration%60).toString().padStart(2, '0')})` 
          })
        } else {
          resolve({ isValid: true, duration })
        }
      }

      const onError = () => {
        cleanup()
        resolve({ isValid: false, duration: 0, error: "Format audio non supporté ou fichier corrompu" })
      }

      audio.addEventListener('loadedmetadata', onLoad)
      audio.addEventListener('error', onError)
      audio.src = url
    })
  }

  const processFile = async (file: File) => {
    setError(null)
    
    const basicError = validateFile(file)
    if (basicError) {
      setError(basicError)
      return
    }

    setIsProcessing(true)
    setUploadProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 85))
      }, 150)

      const audioValidation = await validateAudioFile(file)
      
      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!audioValidation.isValid) {
        setError(audioValidation.error || "Fichier audio invalide")
        return
      }

      const metadata: AudioMetadata = {
        duration: audioValidation.duration,
        size: file.size,
        type: file.type,
        name: file.name,
        isValid: true
      }

      const audioUrl = URL.createObjectURL(file)
      const fileId = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      
      const audioFile: AudioFile = {
        file,
        url: audioUrl,
        metadata,
        id: fileId
      }

      if (multipleFiles) {
        setAudioFiles(prev => [...prev, audioFile])
      } else {
        if (audioFiles.length > 0) URL.revokeObjectURL(audioFiles[0].url)
        setAudioFiles([audioFile])
      }
      
      onFileSelected(file, audioUrl, metadata)
      
    } catch (error) {
      console.error('Erreur lors du traitement du fichier:', error)
      setError("Erreur inattendue lors du traitement du fichier")
    } finally {
      setIsProcessing(false)
      setUploadProgress(0)
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    
    if (multipleFiles) {
      for (let i = 0; i < files.length; i++) {
        await processFile(files[i])
      }
    } else {
      await processFile(files[0])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const files = e.dataTransfer.files
    handleFileSelect(files)
  }

  const handleButtonClick = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault()
      handleButtonClick()
    }
  }

  const removeFile = (id: string) => {
    setAudioFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.url)
        const audio = audioRefs.current.get(id)
        if (audio) {
          audio.pause()
          audioRefs.current.delete(id)
        }
      }
      return prev.filter(f => f.id !== id)
    })
    if (playingId === id) setPlayingId(null)
  }

  const togglePlayback = (id: string, url: string) => {
    const audio = audioRefs.current.get(id) || new Audio(url)
    audioRefs.current.set(id, audio)

    if (playingId === id) {
      audio.pause()
      setPlayingId(null)
    } else {
      audioRefs.current.forEach((otherAudio, otherId) => {
        if (otherId !== id) otherAudio.pause()
      })
      setPlayingId(id)
      audio.play()
      audio.onended = () => setPlayingId(null)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <Card 
        className={`
          transition-all duration-300 cursor-pointer
          ${isDragOver 
            ? 'border-accent bg-accent/5 shadow-gold-glow ring-2 ring-accent/20' 
            : 'border-border hover:border-accent/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-destructive/30' : ''}
        `}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zone de dépôt de fichier audio"
        onDrop={handleDrop}
        onDragOver={debouncedDragOver}
        onDragLeave={debouncedDragLeave}
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className={`
              w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-300
              ${isDragOver 
                ? 'border-accent bg-accent/10 scale-110' 
                : 'border-muted-foreground/30'
              }
           `}>
              {isProcessing ? (
                <div className="animate-spin">
                  <Upload className="w-8 h-8 text-accent" />
                </div>
              ) : (
                <FileAudio className={`w-8 h-8 transition-colors ${isDragOver ? 'text-accent' : 'text-muted-foreground'}`} />
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-lg">
                {isProcessing ? 'Analyse du fichier...' : 'Glissez vos fichiers ici'}
              </h3>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner {multipleFiles ? 'des fichiers' : 'un fichier'}
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {acceptedFormats.map(format => (
                <Badge key={format} variant="secondary" className="text-xs">
                  {format.replace('.', '').toUpperCase()}
                </Badge>
              ))}
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Taille max: {maxSize}MB • Durée max: {formatDuration(maxDuration)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Analyse en cours...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* Error message */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded files */}
      {audioFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">
            Fichiers chargés ({audioFiles.length})
          </h4>
          
          {audioFiles.map(({ file, url, metadata, id }) => (
            <Card key={id} className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Volume2 className="w-5 h-5 text-accent" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{file.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(metadata.duration)}
                        </span>
                        <span>{formatFileSize(file.size)}</span>
                        <Badge variant="outline" className="text-xs">
                          {metadata.type.replace('audio/', '').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {allowPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePlayback(id, url)
                        }}
                        className="h-8 w-8 p-0"
                        aria-label={playingId === id ? 'Pause' : 'Lecture'}
                      >
                        {playingId === id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(id)
                      }}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label="Supprimer le fichier"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Inline audio player */}
                {allowPreview && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <audio 
                      controls 
                      className="w-full h-8" 
                      style={{ maxHeight: '32px' }}
                      preload="none"
                    >
                      <source src={url} type={metadata.type} />
                      Votre navigateur ne supporte pas la lecture audio.
                    </audio>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        multiple={multipleFiles}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
    </div>
  )
}
