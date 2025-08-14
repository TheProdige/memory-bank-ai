import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileAttachment } from '@/components/FileAttachment'
import { RAGAnswerView } from '@/components/RAGAnswerView'
import { useOptimizedRAG } from '@/hooks/useOptimizedRAG'
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  MessageCircle,
  FileText
} from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachedFiles?: Array<{
    id: string
    name: string
    type: string
    size: number
  }>
  ragResult?: any
}

interface ChatWithFilesProps {
  vaultId?: string
  className?: string
}

export const ChatWithFiles = ({ vaultId, className }: ChatWithFilesProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string
    name: string
    type: string
    size: number
  }>>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const { searchMemories } = useOptimizedRAG()

  const handleSendMessage = async () => {
    if (!currentMessage.trim() && attachedFiles.length === 0) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: currentMessage,
      timestamp: new Date(),
      attachedFiles: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setAttachedFiles([])
    setIsLoading(true)

    try {
      // Perform RAG search if there's a text query
      let ragResult = null
      if (currentMessage.trim()) {
        ragResult = await searchMemories(currentMessage, {
          topK: 5,
          threshold: 0.7,
          useLocalSearch: true,
          enableDeduplication: true,
          enableReranking: true
        })
      }

      // Simulate AI response (in real implementation, this would call the AI gateway)
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: ragResult 
          ? `Basé sur vos souvenirs et fichiers, voici ce que j'ai trouvé : ${ragResult.chunks.map(c => c.content).join(' ')}`
          : 'Message reçu avec les fichiers joints. Que souhaitez-vous faire avec ces documents ?',
        timestamp: new Date(),
        ragResult
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'Désolé, une erreur s\'est produite lors du traitement de votre message.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-accent" />
            Chat IA avec fichiers
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Messages */}
          <div className="h-96 overflow-y-auto space-y-4 border rounded-lg p-4 bg-muted/20">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Posez-moi des questions sur vos souvenirs et fichiers !</p>
                <p className="text-sm mt-2">Vous pouvez aussi joindre des documents pour les analyser.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' 
                        ? 'bg-accent text-accent-foreground' 
                        : 'bg-muted'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    <div className={`rounded-lg p-4 ${
                      message.type === 'user'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-background border'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      
                      {/* Attached Files */}
                      {message.attachedFiles && message.attachedFiles.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.attachedFiles.map((file) => (
                            <Badge key={file.id} variant="secondary" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              {file.name}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* RAG Results */}
                      {message.ragResult && (
                        <div className="mt-3">
                          <div className="text-xs text-muted-foreground mb-2">
                            Sources trouvées ({message.ragResult.chunks?.length || 0})
                          </div>
                          {message.ragResult.chunks?.slice(0, 2).map((chunk: any, idx: number) => (
                            <div key={idx} className="text-xs bg-muted/50 p-2 rounded mb-1">
                              {chunk.content.slice(0, 100)}...
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-background border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">L'IA réfléchit...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* File Attachment */}
          <FileAttachment
            attachedFiles={attachedFiles}
            onFilesSelected={setAttachedFiles}
            onRemoveFile={(fileId) => {
              setAttachedFiles(prev => prev.filter(f => f.id !== fileId))
            }}
            vaultId={vaultId}
            maxFiles={3}
            buttonText="Joindre des fichiers"
          />

          {/* Message Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Posez votre question ou discutez de vos fichiers..."
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={isLoading || (!currentMessage.trim() && attachedFiles.length === 0)}
              className="px-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            💡 Astuce : Joignez des documents pour les analyser ou posez des questions sur vos souvenirs existants
          </div>
        </CardContent>
      </Card>
    </div>
  )
}