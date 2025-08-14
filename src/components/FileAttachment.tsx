import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FileManager } from '@/components/FileManager'
import { Paperclip, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
}

interface FileAttachmentProps {
  onFilesSelected?: (files: AttachedFile[]) => void
  attachedFiles?: AttachedFile[]
  onRemoveFile?: (fileId: string) => void
  className?: string
  vaultId?: string
  maxFiles?: number
  buttonText?: string
}

export const FileAttachment = ({
  onFilesSelected,
  attachedFiles = [],
  onRemoveFile,
  className,
  vaultId,
  maxFiles = 5,
  buttonText = "Joindre des fichiers"
}: FileAttachmentProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<AttachedFile[]>(attachedFiles)

  const handleFileSelect = (fileId: string) => {
    // This would be called from FileManager when a file is selected
    // For now, we'll implement a basic selection mechanism
    console.log('File selected:', fileId)
  }

  const handleAddFiles = () => {
    onFilesSelected?.(selectedFiles)
    setIsOpen(false)
  }

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = selectedFiles.filter(f => f.id !== fileId)
    setSelectedFiles(updatedFiles)
    onRemoveFile?.(fileId)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={className}>
      {/* Attached Files Display */}
      {attachedFiles.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Fichiers joints ({attachedFiles.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <Badge 
                key={file.id} 
                variant="secondary" 
                className="flex items-center gap-2 pr-1 max-w-xs"
              >
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(file.size)})
                </span>
                {onRemoveFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(file.id)}
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Attach Files Button */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={attachedFiles.length >= maxFiles}
            className="flex items-center gap-2"
          >
            <Paperclip className="w-4 h-4" />
            {buttonText}
            {maxFiles < 999 && (
              <span className="text-xs text-muted-foreground ml-1">
                ({attachedFiles.length}/{maxFiles})
              </span>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Gestionnaire de fichiers</DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto">
            <FileManager 
              vaultId={vaultId}
              onFileSelect={handleFileSelect}
              className="border-0"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddFiles} disabled={selectedFiles.length === 0}>
              Ajouter les fichiers sélectionnés
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}