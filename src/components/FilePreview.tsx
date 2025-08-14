import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  FileText, 
  Eye, 
  Download, 
  Share, 
  Edit3,
  Copy,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'

interface FilePreviewProps {
  fileId: string
  fileName: string
  fileType: string
  extractedText?: string
  fileSize: number
  createdAt: string
  onDownload?: () => void
  onShare?: () => void
}

export const FilePreview = ({
  fileId,
  fileName,
  fileType,
  extractedText,
  fileSize,
  createdAt,
  onDownload,
  onShare
}: FilePreviewProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [editedText, setEditedText] = useState(extractedText || '')
  const [isEditing, setIsEditing] = useState(false)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleCopyText = () => {
    if (extractedText) {
      navigator.clipboard.writeText(extractedText)
      toast.success('Texte copié dans le presse-papiers')
    }
  }

  const handleSaveEdit = () => {
    // Here you would typically save the edited text to the database
    console.log('Saving edited text for file:', fileId, editedText)
    toast.success('Modifications sauvegardées')
    setIsEditing(false)
  }

  const getFileIcon = () => {
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType.startsWith('audio/')) return '🎵'
    if (fileType.startsWith('video/')) return '🎬'
    if (fileType === 'application/pdf') return '📄'
    if (fileType.includes('document')) return '📝'
    return '📁'
  }

  const displayText = extractedText?.trim() || 'Aucun texte extrait pour ce fichier.'
  const hasValidText = extractedText && extractedText.trim() && extractedText.length > 10

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{getFileIcon()}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{fileName}</div>
              <div className="text-sm text-muted-foreground font-normal">
                {formatFileSize(fileSize)} • {new Date(createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 overflow-y-auto">
          {/* File Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Informations du fichier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type :</span> {fileType}
                </div>
                <div>
                  <span className="font-medium">Taille :</span> {formatFileSize(fileSize)}
                </div>
                <div>
                  <span className="font-medium">Créé le :</span> {new Date(createdAt).toLocaleString('fr-FR')}
                </div>
                <div>
                  <span className="font-medium">ID :</span> <code className="text-xs bg-muted px-1 rounded">{fileId.slice(0, 8)}...</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Preview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Contenu extrait
                  {hasValidText && (
                    <Badge variant="secondary" className="ml-2">
                      {extractedText.length} caractères
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {hasValidText && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCopyText}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copier
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        {isEditing ? 'Annuler' : 'Éditer'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasValidText ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Aucun texte disponible</p>
                  <p className="text-sm">
                    Ce fichier n'a pas de contenu textuel extrait ou nécessite un traitement serveur.
                  </p>
                  <Button variant="outline" className="mt-4" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Analyser avec l'IA
                  </Button>
                </div>
              ) : isEditing ? (
                <div className="space-y-4">
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Contenu du fichier..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleSaveEdit}>
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 rounded-lg border overflow-auto max-h-[400px]">
                    {displayText}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onDownload}>
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
              {onShare && (
                <Button variant="outline" onClick={onShare}>
                  <Share className="w-4 h-4 mr-2" />
                  Partager
                </Button>
              )}
            </div>
            <Button onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}