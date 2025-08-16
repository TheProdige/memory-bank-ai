/**
 * World-class File Manager - Optimized & Accessible Version
 * Implements all best practices: performance, security, accessibility, monitoring
 */

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  useRef
} from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileUpload } from '@/components/FileUpload'
import { useFileManagement } from '@/hooks/useFileManagement'
import { FilePreview } from '@/components/FilePreview'
import { 
  Upload, 
  Search, 
  Download, 
  Trash2, 
  Eye, 
  FileText, 
  Image, 
  Music, 
  Video,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Filter,
  SortAsc,
  RefreshCw
} from 'lucide-react'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAccessibility, AccessibleButton, AccessibleField } from '@/lib/accessibility/AccessibilityEnhancer'
import { VirtualizedList, useOptimizedSearch, usePerformanceMonitor } from '@/lib/performance/ComponentOptimizer'
import { inputValidator } from '@/lib/security/InputValidator'
import { Logger } from '@/core/logging/Logger'
import { toast } from 'sonner'

interface FileManagerProps {
  vaultId?: string
  onFileSelect?: (fileId: string) => void
  className?: string
  'aria-label'?: string
}

interface FileTypeIconProps {
  mimeType: string
  className?: string
  'aria-hidden'?: boolean
}

const FileTypeIcon = React.memo<FileTypeIconProps>(({ 
  mimeType, 
  className,
  'aria-hidden': ariaHidden = true 
}) => {
  const Icon = useMemo(() => {
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.startsWith('audio/')) return Music
    if (mimeType.startsWith('video/')) return Video
    return FileText
  }, [mimeType])

  return <Icon className={className} aria-hidden={ariaHidden} />
})

FileTypeIcon.displayName = 'FileTypeIcon'

interface StatusBadgeProps {
  status: string
  isIndexed: boolean
  'aria-describedby'?: string
}

const StatusBadge = React.memo<StatusBadgeProps>(({ 
  status, 
  isIndexed,
  'aria-describedby': ariaDescribedBy 
}) => {
  const badgeConfig = useMemo(() => {
    if (status === 'completed' && isIndexed) {
      return {
        variant: 'default' as const,
        className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
        icon: CheckCircle,
        text: 'Indexé',
        ariaLabel: 'Fichier traité et indexé avec succès'
      }
    }
    if (status === 'processing') {
      return {
        variant: 'secondary' as const,
        className: 'bg-blue-500 text-white',
        icon: Loader2,
        text: 'Traitement',
        ariaLabel: 'Fichier en cours de traitement'
      }
    }
    if (status === 'failed') {
      return {
        variant: 'destructive' as const,
        className: '',
        icon: AlertCircle,
        text: 'Échec',
        ariaLabel: 'Échec du traitement du fichier'
      }
    }
    return {
      variant: 'outline' as const,
      className: 'border-amber-500 text-amber-700 dark:text-amber-300',
      icon: Clock,
      text: 'En attente',
      ariaLabel: 'Fichier en attente de traitement'
    }
  }, [status, isIndexed])

  const IconComponent = badgeConfig.icon

  return (
    <Badge 
      variant={badgeConfig.variant} 
      className={badgeConfig.className}
      aria-label={badgeConfig.ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <IconComponent 
        className={`w-3 h-3 mr-1 ${status === 'processing' ? 'animate-spin' : ''}`} 
        aria-hidden="true"
      />
      {badgeConfig.text}
    </Badge>
  )
})

StatusBadge.displayName = 'StatusBadge'

type SortOption = 'name' | 'size' | 'date' | 'type'
type FilterOption = 'all' | 'images' | 'documents' | 'audio' | 'video'

export const FileManager = React.memo<FileManagerProps>(({ 
  vaultId, 
  onFileSelect, 
  className,
  'aria-label': ariaLabel = 'Gestionnaire de fichiers' 
}) => {
  // Performance monitoring
  usePerformanceMonitor('FileManager')
  
  // Accessibility
  const { announceMessage } = useAccessibility()
  
  // File management
  const { 
    files, 
    isLoading, 
    uploadProgress, 
    uploadFile, 
    fetchFiles, 
    deleteFile, 
    getFileUrl 
  } = useFileManagement()
  
  // Local state
  const [showUpload, setShowUpload] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Refs for accessibility
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Optimized search
  const { query, setQuery, results: searchResults, isSearching } = useOptimizedSearch(
    files,
    ['originalFilename', 'extractedText', 'tags'],
    300
  )
  
  // Memoized filtered and sorted files
  const processedFiles = useMemo(() => {
    let filtered = searchResults
    
    // Apply type filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(file => {
        switch (filterBy) {
          case 'images': return file.mimeType.startsWith('image/')
          case 'documents': return file.mimeType.includes('pdf') || file.mimeType.includes('document') || file.mimeType === 'text/plain'
          case 'audio': return file.mimeType.startsWith('audio/')
          case 'video': return file.mimeType.startsWith('video/')
          default: return true
        }
      })
    }
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.originalFilename.localeCompare(b.originalFilename)
          break
        case 'size':
          comparison = a.fileSize - b.fileSize
          break
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'type':
          comparison = a.mimeType.localeCompare(b.mimeType)
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [searchResults, filterBy, sortBy, sortDirection])
  
  // Effects
  useEffect(() => {
    fetchFiles(vaultId)
  }, [fetchFiles, vaultId])
  
  // Announce state changes for screen readers
  useEffect(() => {
    if (!isLoading && files.length > 0) {
      announceMessage(`${files.length} fichier${files.length > 1 ? 's' : ''} chargé${files.length > 1 ? 's' : ''}`)
    }
  }, [files.length, isLoading, announceMessage])
  
  // Event handlers
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      // Validate file before upload
      const validation = inputValidator.validateFileUpload(file)
      if (!validation.isValid) {
        validation.errors.forEach(error => toast.error(error))
        return
      }
      
      Logger.info('File upload started', {
        fileName: validation.sanitizedName || file.name,
        fileSize: file.size,
        fileType: file.type,
        vaultId
      })
      
      const options = {
        vaultId,
        enableLocalProcessing: true,
        extractText: true,
        generateEmbeddings: true
      }

      const result = await uploadFile(file, options)
      
      if (result) {
        announceMessage(`Fichier "${file.name}" uploadé avec succès`)
        Logger.info('File upload completed', {
          fileId: result.id,
          fileName: result.originalFilename
        })
      }
      
      setShowUpload(false)
    } catch (error) {
      Logger.error('File upload failed', { error, fileName: file.name })
      toast.error('Erreur lors de l\'upload du fichier')
    }
  }, [uploadFile, vaultId, announceMessage])

  const handleDownload = useCallback(async (file: any) => {
    try {
      Logger.info('File download started', { fileId: file.id, fileName: file.originalFilename })
      
      const url = await getFileUrl(file)
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.download = file.originalFilename
        link.setAttribute('aria-label', `Télécharger ${file.originalFilename}`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        announceMessage(`Téléchargement de "${file.originalFilename}" démarré`)
        Logger.info('File download completed', { fileId: file.id })
      }
    } catch (error) {
      Logger.error('File download failed', { error, fileId: file.id })
      toast.error('Erreur lors du téléchargement')
    }
  }, [getFileUrl, announceMessage])
  
  const handleDelete = useCallback(async (file: any) => {
    try {
      Logger.info('File deletion started', { fileId: file.id, fileName: file.originalFilename })
      
      const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer "${file.originalFilename}" ?`)
      if (!confirmed) return
      
      const success = await deleteFile(file.id)
      if (success) {
        announceMessage(`Fichier "${file.originalFilename}" supprimé`)
        Logger.info('File deletion completed', { fileId: file.id })
      }
    } catch (error) {
      Logger.error('File deletion failed', { error, fileId: file.id })
      toast.error('Erreur lors de la suppression')
    }
  }, [deleteFile, announceMessage])
  
  const handleRefresh = useCallback(() => {
    fetchFiles(vaultId)
    announceMessage('Liste des fichiers actualisée')
  }, [fetchFiles, vaultId, announceMessage])
  
  const handleSortChange = useCallback((newSort: SortOption) => {
    if (newSort === sortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSort)
      setSortDirection('asc')
    }
  }, [sortBy])
  
  // Utility functions
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [])

  const getSupportedFormats = useCallback(() => [
    '.pdf', '.docx', '.txt', // Documents
    '.png', '.jpg', '.jpeg', // Images
    '.mp3', '.wav', '.m4a', // Audio
    '.mp4', '.webm' // Video
  ], [])
  
  // File list renderer for virtualization
  const renderFileItem = useCallback((file: any, index: number) => (
    <Card 
      key={file.id} 
      className="hover:shadow-lg transition-shadow"
      role="article"
      aria-labelledby={`file-title-${file.id}`}
      aria-describedby={`file-details-${file.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* File Icon */}
          <div 
            className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0"
            role="img"
            aria-label={`Icône de fichier ${file.mimeType}`}
          >
            <FileTypeIcon mimeType={file.mimeType} className="w-6 h-6 text-accent" />
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h4 
                  id={`file-title-${file.id}`}
                  className="font-medium truncate"
                >
                  {file.originalFilename}
                </h4>
                <div 
                  id={`file-details-${file.id}`}
                  className="flex items-center gap-3 mt-1 text-sm text-muted-foreground"
                >
                  <span>{formatFileSize(file.fileSize)}</span>
                  <span aria-hidden="true">•</span>
                  <time dateTime={file.createdAt}>
                    {formatDistance(new Date(file.createdAt), new Date(), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </time>
                  <StatusBadge 
                    status={file.processingStatus} 
                    isIndexed={file.isIndexed}
                    aria-describedby={`file-status-${file.id}`}
                  />
                </div>

                {/* Tags */}
                {file.tags && file.tags.length > 0 && (
                  <div 
                    className="flex flex-wrap gap-1 mt-2"
                    role="list"
                    aria-label="Tags du fichier"
                  >
                    {file.tags.map((tag: string, idx: number) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs"
                        role="listitem"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Extracted Text Preview */}
                {file.extractedText && file.extractedText.trim() && (
                  <div 
                    className="mt-2 p-3 bg-muted/50 rounded-lg border border-border/50"
                    aria-label="Aperçu du contenu extrait"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-accent" aria-hidden="true" />
                      <span className="text-sm font-medium text-foreground">
                        Aperçu du contenu
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {file.extractedText.length > 200 
                        ? `${file.extractedText.slice(0, 200)}...` 
                        : file.extractedText
                      }
                    </p>
                    {file.extractedText.length > 200 && (
                      <AccessibleButton 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 h-auto p-0 text-accent hover:text-accent/80"
                        onClick={() => Logger.info('Full text view requested', { fileId: file.id })}
                        aria-label={`Voir le texte complet du fichier ${file.originalFilename}`}
                      >
                        Voir le texte complet ({file.extractedText.length} caractères)
                      </AccessibleButton>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div 
                className="flex items-center gap-2 flex-shrink-0"
                role="group"
                aria-label={`Actions pour ${file.originalFilename}`}
              >
                <FilePreview
                  fileId={file.id}
                  fileName={file.originalFilename}
                  fileType={file.mimeType}
                  extractedText={file.extractedText}
                  fileSize={file.fileSize}
                  createdAt={file.createdAt}
                  onDownload={() => handleDownload(file)}
                />
                
                <AccessibleButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file)}
                  className="h-8 w-8 p-0"
                  aria-label={`Télécharger ${file.originalFilename}`}
                >
                  <Download className="w-4 h-4" />
                </AccessibleButton>

                <AccessibleButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(file)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Supprimer ${file.originalFilename}`}
                >
                  <Trash2 className="w-4 h-4" />
                </AccessibleButton>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formatFileSize, handleDownload, handleDelete])

  return (
    <div 
      ref={containerRef}
      className={`space-y-6 ${className}`}
      aria-label={ariaLabel}
      role="region"
    >
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" aria-hidden="true" />
              Gestionnaire de fichiers
              {files.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {files.length} fichier{files.length > 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <AccessibleButton 
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                aria-label="Actualiser la liste des fichiers"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </AccessibleButton>
              <AccessibleButton 
                onClick={() => setShowUpload(!showUpload)}
                className="bg-gradient-gold text-primary-foreground hover:bg-gradient-gold/90"
                aria-expanded={showUpload}
                aria-controls="upload-section"
              >
                <Upload className="w-4 h-4 mr-2" />
                {showUpload ? 'Masquer l\'upload' : 'Ajouter des fichiers'}
              </AccessibleButton>
            </div>
          </div>
        </CardHeader>

        {showUpload && (
          <CardContent id="upload-section">
            <FileUpload
              onFileSelected={handleFileUpload}
              acceptedFormats={getSupportedFormats()}
              maxSize={50}
              maxDuration={600}
              allowPreview={true}
              multipleFiles={false}
            />
          </CardContent>
        )}
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <AccessibleField
            id="file-search"
            label="Rechercher dans les fichiers"
            hint="Recherchez par nom, contenu ou tags"
          >
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" 
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                placeholder="Rechercher dans les fichiers (nom, contenu, tags)..."
                value={query}
                onChange={(e) => {
                  const validation = inputValidator.validateSearchQuery(e.target.value)
                  if (validation.isValid) {
                    setQuery(validation.sanitized)
                  } else {
                    setQuery(validation.sanitized)
                    validation.errors.forEach(error => toast.warning(error))
                  }
                }}
                className="pl-10"
                aria-describedby="search-status"
              />
              {isSearching && (
                <div 
                  id="search-status" 
                  className="sr-only" 
                  aria-live="polite"
                >
                  Recherche en cours...
                </div>
              )}
            </div>
          </AccessibleField>
          
          {/* Filters and Sort */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Filtrer :</span>
              {(['all', 'images', 'documents', 'audio', 'video'] as FilterOption[]).map((filter) => (
              <Button
                key={filter}
                variant={filterBy === filter ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterBy(filter)}
                  aria-pressed={filterBy === filter}
                >
                  {filter === 'all' ? 'Tout' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </AccessibleButton>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Trier :</span>
              {(['name', 'size', 'date', 'type'] as SortOption[]).map((sort) => (
              <Button
                key={sort}
                variant={sortBy === sort ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange(sort)}
                  aria-pressed={sortBy === sort}
                  aria-label={`Trier par ${sort}${sortBy === sort ? `, actuellement ${sortDirection === 'asc' ? 'croissant' : 'décroissant'}` : ''}`}
                >
                  {sort === 'name' ? 'Nom' : 
                   sort === 'size' ? 'Taille' :
                   sort === 'date' ? 'Date' : 'Type'}
                  {sortBy === sort && (
                    <span className="ml-1" aria-hidden="true">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </AccessibleButton>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3" role="status" aria-live="polite">
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Upload en cours...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress 
                    value={progress} 
                    className="h-2" 
                    aria-label={`Progression de l'upload: ${progress}%`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-muted-foreground">Chargement des fichiers...</p>
          </CardContent>
        </Card>
      ) : processedFiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {query ? 'Aucun fichier trouvé' : 'Aucun fichier'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {query 
                ? 'Essayez de modifier votre recherche'
                : 'Commencez par uploader vos premiers fichiers'
              }
            </p>
            {!query && (
              <AccessibleButton 
                onClick={() => setShowUpload(true)}
                variant="outline"
                aria-label="Ouvrir le formulaire d'upload de fichiers"
              >
                <Upload className="w-4 h-4 mr-2" />
                Ajouter des fichiers
              </AccessibleButton>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" role="feed" aria-label="Liste des fichiers">
          {processedFiles.length > 10 ? (
            <VirtualizedList
              items={processedFiles}
              itemHeight={200}
              containerHeight={800}
              renderItem={renderFileItem}
              overscan={3}
            />
          ) : (
            processedFiles.map((file, index) => renderFileItem(file, index))
          )}
        </div>
      )}
    </div>
  )
})

FileManager.displayName = 'FileManager'