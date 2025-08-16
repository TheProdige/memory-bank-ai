// Composant pour afficher les réponses RAG avec sources cliquables
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  CheckCircle,
  AlertCircle,
  FileText,
  Tag,
  Zap,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRAGSystem } from '@/hooks/useRAGSystem';
import { generateLocalSummary } from '@/lib/localModels';
import { analyzeComplexity } from '@/lib/complexityDetector';
import { Logger } from '@/core/logging/Logger';
import { cn } from '@/lib/utils';

interface RAGResponse {
  answer: string;
  summary: string;
  tags: string[];
  sources: Array<{
    id: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
    memoryId: string;
  }>;
  confidence: number;
  processingTime: number;
  model: 'local' | 'api' | 'hybrid';
  totalTokens: number;
  cost: number;
  optimizations: string[];
}

interface RAGAnswerViewProps {
  query: string;
  onSourceClick: (memoryId: string) => void;
  className?: string;
}

export const RAGAnswerView: React.FC<RAGAnswerViewProps> = ({
  query,
  onSourceClick,
  className
}) => {
  const { query: ragQuery, loading } = useRAGSystem();
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Recherche et génération de réponse
  const performRAGSearch = async (retryAttempt = 0) => {
    if (!query.trim()) return;

    setError(null);
    setRetryCount(retryAttempt);

    try {
      Logger.info('Starting RAG search', { query, retryAttempt });

      // 1. Analyser la complexité de la requête
      const complexity = analyzeComplexity(query);
      
      // 2. Execute RAG query
      const startTime = performance.now();
      const ragResult = await ragQuery(query);

      if (!ragResult) {
        setResponse({
          answer: "Aucune information pertinente trouvée dans vos mémoires.",
          summary: "Recherche sans résultat",
          tags: [],
          sources: [],
          confidence: 0,
          processingTime: performance.now() - startTime,
          model: 'local',
          totalTokens: 0,
          cost: 0,
          optimizations: ['no-results']
        });
        return;
      }

      // Convert RAG response to our format
      const tags = extractTags(ragResult.answer);
      const sources = ragResult.sources.map(source => ({
        id: source.id,
        title: source.title,
        excerpt: source.content.slice(0, 150) + '...',
        relevanceScore: 0.8, // Default score
        memoryId: source.id
      }));

      const finalResponse: RAGResponse = {
        answer: ragResult.answer,
        summary: generateQuerySummary(query, ragResult.sources.length),
        tags,
        sources,
        confidence: ragResult.confidence,
        processingTime: ragResult.metadata.processingTime,
        model: ragResult.metadata.model as any,
        totalTokens: ragResult.metadata.tokensUsed,
        cost: ragResult.metadata.cost,
        optimizations: ['rag-orchestrator']
      };

      setResponse(finalResponse);

      Logger.info('RAG search completed', {
        query,
        sourcesFound: ragResult.sources.length,
        confidence: ragResult.confidence,
        processingTime: ragResult.metadata.processingTime
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      Logger.error('RAG search failed', { error: err, query, retryAttempt });
      
      if (retryAttempt < 2) {
        // Retry avec délai progressif
        setTimeout(() => {
          performRAGSearch(retryAttempt + 1);
        }, Math.pow(2, retryAttempt) * 1000);
      } else {
        setError(errorMessage);
      }
    }
  };

  // Génération de réponse dégradée
  const generateDegradedResponse = (query: string, reason: string): void => {
    setResponse({
      answer: `Quota atteint. Réponse simplifiée : recherchez "${query}" dans vos mémoires récentes.`,
      summary: "Mode économie activé",
      tags: ['quota-limite'],
      sources: [],
      confidence: 0.3,
      processingTime: 50,
      model: 'local',
      totalTokens: 0,
      cost: 0,
      optimizations: ['cost-limited', 'degraded-mode']
    });
  };

  // Retry manuel
  const handleRetry = () => {
    setResponse(null);
    setError(null);
    performRAGSearch(0);
  };

  // Déclenchement automatique de la recherche
  React.useEffect(() => {
    if (query.trim()) {
      performRAGSearch();
    }
  }, [query]);

  // Couleur de confiance
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600';
    if (confidence >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* En-tête de recherche */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Recherche intelligente</h3>
          <p className="text-sm text-muted-foreground">"{query}"</p>
        </div>
        {response && (
          <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        )}
      </div>

      {/* État de chargement */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <AlertDescription>
                Recherche en cours dans vos mémoires...
                {retryCount > 0 && ` (tentative ${retryCount + 1})`}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erreur */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Erreur: {error}</span>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Réponse */}
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Métriques rapides */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Confiance</span>
                </div>
                <div className={cn("text-lg font-bold", getConfidenceColor(response.confidence))}>
                  {Math.round(response.confidence * 100)}%
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Temps</span>
                </div>
                <div className="text-lg font-bold">
                  {Math.round(response.processingTime)}ms
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">Modèle</span>
                </div>
                <div className="text-lg font-bold capitalize">
                  {response.model}
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Sources</span>
                </div>
                <div className="text-lg font-bold">
                  {response.sources.length}
                </div>
              </div>
            </div>

            {/* Réponse principale */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Réponse</CardTitle>
                  <div className="flex gap-2">
                    {response.optimizations.map((opt, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {opt}
                      </Badge>
                    ))}
                    {response.cost === 0 && (
                      <Badge variant="outline" className="text-green-600">
                        Gratuit
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>{response.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-base leading-relaxed">{response.answer}</p>
                </div>
                
                {/* Tags */}
                {response.tags.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {response.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sources cliquables */}
            {response.sources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" />
                    Sources ({response.sources.length})
                  </CardTitle>
                  <CardDescription>
                    Cliquez sur une source pour voir la mémoire complète
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-64">
                    <div className="space-y-3">
                      {response.sources.map((source, index) => (
                        <motion.div
                          key={source.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => onSourceClick(source.memoryId)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{source.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {source.excerpt}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <Badge variant="outline" className="text-xs">
                                {Math.round(source.relevanceScore * 100)}%
                              </Badge>
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Fonctions utilitaires

function extractTags(content: string): string[] {
  const words = content.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !/^\d+$/.test(word)); // Exclure les nombres purs

  // Compter les fréquences
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Prendre les mots les plus fréquents
  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

function generateQuerySummary(query: string, sourceCount: number): string {
  if (sourceCount === 0) {
    return "Aucune source trouvée pour cette recherche";
  }
  
  const complexity = query.split(' ').length > 5 ? 'complexe' : 'simple';
  return `Recherche ${complexity} • ${sourceCount} source${sourceCount > 1 ? 's' : ''} analysée${sourceCount > 1 ? 's' : ''}`;
}

export default RAGAnswerView;