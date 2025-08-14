import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useFileManagement } from '@/hooks/useFileManagement'
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react'

export const FileSystemDiagnostic = () => {
  const { files, isLoading, fetchFiles } = useFileManagement()
  const [diagnosticResult, setDiagnosticResult] = useState<{
    totalFiles: number
    filesWithText: number
    blankFiles: number
    errors: string[]
    recommendations: string[]
  } | null>(null)

  useEffect(() => {
    runDiagnostic()
  }, [files])

  const runDiagnostic = () => {
    const result = {
      totalFiles: files.length,
      filesWithText: files.filter(f => f.extractedText && f.extractedText.trim().length > 10).length,
      blankFiles: files.filter(f => !f.extractedText || f.extractedText.trim().length <= 10).length,
      errors: [],
      recommendations: []
    }

    // Add recommendations based on analysis
    if (result.blankFiles > 0) {
      result.recommendations.push(
        `${result.blankFiles} fichier(s) ont un contenu vide ou très court. Ceci est normal pour les PDF, DOCX et images qui nécessitent un traitement serveur.`
      )
    }

    if (result.totalFiles === 0) {
      result.recommendations.push('Aucun fichier détecté. Essayez d\'uploader un fichier pour tester le système.')
    }

    if (result.filesWithText > 0) {
      result.recommendations.push(`✅ ${result.filesWithText} fichier(s) avec contenu extrait correctement.`)
    }

    setDiagnosticResult(result)
  }

  const handleRefresh = async () => {
    await fetchFiles()
    runDiagnostic()
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Diagnostic en cours...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Diagnostic du système de fichiers
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {diagnosticResult && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-foreground">{diagnosticResult.totalFiles}</div>
                <div className="text-sm text-muted-foreground">Total fichiers</div>
              </div>
              
              <div className="text-center p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <div className="text-2xl font-bold text-emerald-600">{diagnosticResult.filesWithText}</div>
                <div className="text-sm text-muted-foreground">Avec contenu</div>
              </div>
              
              <div className="text-center p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-600">{diagnosticResult.blankFiles}</div>
                <div className="text-sm text-muted-foreground">Contenu vide</div>
              </div>
            </div>

            {/* Status */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>État du système :</strong>{' '}
                {diagnosticResult.totalFiles === 0 ? (
                  <span className="text-amber-600">Aucun fichier - Système prêt pour les uploads</span>
                ) : diagnosticResult.blankFiles === 0 ? (
                  <span className="text-emerald-600">Tous les fichiers ont un contenu extrait</span>
                ) : (
                  <span className="text-blue-600">Système fonctionnel - Certains fichiers nécessitent un traitement serveur</span>
                )}
              </AlertDescription>
            </Alert>

            {/* Recommendations */}
            {diagnosticResult.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Recommandations :</h4>
                {diagnosticResult.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}

            {/* File Details */}
            {files.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Détails par fichier :</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {files.slice(0, 5).map((file) => (
                    <div key={file.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                      <span className="truncate flex-1">{file.originalFilename}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={file.extractedText && file.extractedText.trim().length > 10 ? 'default' : 'secondary'} className="text-xs">
                          {file.extractedText && file.extractedText.trim().length > 10 
                            ? `${file.extractedText.length} chars` 
                            : 'Vide'
                          }
                        </Badge>
                        {file.processingStatus === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  {files.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      ... et {files.length - 5} autres fichiers
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}