import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileUpload } from '@/components/FileUpload'
import { useFileManagement } from '@/hooks/useFileManagement'
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
  Loader2
} from 'lucide-react'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'

interface FileManagerProps {
  vaultId?: string
  onFileSelect?: (fileId: string) => void
  className?: string
}

const FileTypeIcon = ({ mimeType, className }: { mimeType: string; className?: string }) => {
  if (mimeType.startsWith('image/')) return <Image className={className} />
  if (mimeType.startsWith('audio/')) return <Music className={className} />
  if (mimeType.startsWith('video/')) return <Video className={className} />
  return <FileText className={className} />
}

const StatusBadge = ({ status, isIndexed }: { status: string; isIndexed: boolean }) => {
  if (status === 'completed' && isIndexed) {
    return <Badge variant="default" className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1" />Indexé</Badge>
  }
  if (status === 'processing') {
    return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Traitement</Badge>
  }
  if (status === 'failed') {
    return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Échec</Badge>
  }
  return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />En attente</Badge>
}

export const FileManager = ({ vaultId, onFileSelect, className }: FileManagerProps) => {
  const { files, isLoading, uploadProgress, uploadFile, fetchFiles, deleteFile, getFileUrl } = useFileManagement()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchFiles(vaultId)
  }, [fetchFiles, vaultId])

  const filteredFiles = files.filter(file => 
    file.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.extractedText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleFileUpload = async (file: File) => {
    const options = {
      vaultId,
      enableLocalProcessing: true,
      extractText: true,
      generateEmbeddings: true
    }

    await uploadFile(file, options)
    setShowUpload(false)
  }

  const handleDownload = async (file: any) => {
    const url = await getFileUrl(file)
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getSupportedFormats = () => [
    '.pdf', '.docx', '.txt', // Documents
    '.png', '.jpg', '.jpeg', // Images
    '.mp3', '.wav', '.m4a', // Audio
    '.mp4', '.webm' // Video
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Gestionnaire de fichiers
              {files.length > 0 && (
                <Badge variant="secondary">{files.length} fichier{files.length > 1 ? 's' : ''}</Badge>
              )}
            </CardTitle>
            <Button 
              onClick={() => setShowUpload(!showUpload)}
              className="bg-gradient-gold text-primary-foreground"
            >
              <Upload className="w-4 h-4 mr-2" />
              Ajouter des fichiers
            </Button>
          </div>
        </CardHeader>

        {showUpload && (
          <CardContent>
            <FileUpload
              onFileSelected={handleFileUpload}
              acceptedFormats={getSupportedFormats()}
              maxSize={50}
              maxDuration={600} // 10 minutes for audio/video
              allowPreview={true}
              multipleFiles={false}
            />
          </CardContent>
        )}
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher dans les fichiers (nom, contenu, tags)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Upload en cours...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
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
      ) : filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'Aucun fichier trouvé' : 'Aucun fichier'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Essayez de modifier votre recherche'
                : 'Commencez par uploader vos premiers fichiers'
              }
            </p>
            {!searchQuery && (
              <Button 
                onClick={() => setShowUpload(true)}
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                Ajouter des fichiers
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredFiles.map((file) => (
            <Card key={file.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* File Icon */}
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <FileTypeIcon mimeType={file.mimeType} className="w-6 h-6 text-accent" />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate">{file.originalFilename}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>•</span>
                          <span>
                            {formatDistance(new Date(file.createdAt), new Date(), { 
                              addSuffix: true, 
                              locale: fr 
                            })}
                          </span>
                          <StatusBadge status={file.processingStatus} isIndexed={file.isIndexed} />
                        </div>

                        {/* Tags */}
                        {file.tags && file.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {file.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Extracted Text Preview */}
                        {file.extractedText && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                            <p className="line-clamp-2">
                              {file.extractedText.slice(0, 150)}
                              {file.extractedText.length > 150 && '...'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {onFileSelect && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onFileSelect(file.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFile(file.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}