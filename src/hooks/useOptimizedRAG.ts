import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { localVectorSearch } from '@/lib/localModels';

interface RAGOptions {
  chunkSize?: number;
  overlap?: number;
  topK?: number;
  threshold?: number;
  enableDeduplication?: boolean;
  enableReranking?: boolean;
  useLocalSearch?: boolean;
}

interface RAGResult {
  chunks: Array<{
    id: string;
    content: string;
    score: number;
    source: string;
  }>;
  processingTime: number;
  model: 'local' | 'api' | 'hybrid';
  totalTokens: number;
  optimizationApplied: string[];
}

export const useOptimizedRAG = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const searchMemories = useCallback(async (
    query: string,
    options: RAGOptions = {}
  ): Promise<RAGResult> => {
    const startTime = performance.now();
    setLoading(true);
    
    const {
      chunkSize = 720,
      overlap = 64,
      topK = 4,
      threshold = 0.7,
      enableDeduplication = true,
      enableReranking = true,
      useLocalSearch = true
    } = options;
    
    try {
      const optimizations: string[] = [];
      
      // 1. Récupérer toutes les mémoires de l'utilisateur
      const { data: memories, error } = await supabase
        .from('memories')
        .select('id, title, transcript, summary, tags, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!memories || memories.length === 0) {
        return {
          chunks: [],
          processingTime: performance.now() - startTime,
          model: 'local',
          totalTokens: 0,
          optimizationApplied: ['no-data']
        };
      }
      
      // 2. Recherche locale d'abord (économise les tokens)
      if (useLocalSearch) {
        const localResults = localVectorSearch(
          query,
          memories.map(m => ({
            id: m.id,
            content: `${m.title || ''} ${m.transcript || ''} ${m.summary || ''}`,
            title: m.title
          })),
          topK * 2 // Récupérer plus pour permettre le re-ranking
        );
        
        if (localResults.length > 0) {
          optimizations.push('local-search');
          
          const chunks = localResults.slice(0, topK).map(result => {
            const memory = memories.find(m => m.id === result.id)!;
            return {
              id: result.id,
              content: optimizeChunk(result.excerpt, chunkSize),
              score: result.score,
              source: memory.title || 'Sans titre'
            };
          });
          
          // 3. Déduplication
          const deduplicatedChunks = enableDeduplication 
            ? deduplicateChunks(chunks)
            : chunks;
          
          if (enableDeduplication && deduplicatedChunks.length < chunks.length) {
            optimizations.push('deduplication');
          }
          
          const totalTokens = deduplicatedChunks.reduce(
            (total, chunk) => total + estimateTokens(chunk.content), 
            0
          );
          
          return {
            chunks: deduplicatedChunks,
            processingTime: performance.now() - startTime,
            model: 'local',
            totalTokens,
            optimizationApplied: optimizations
          };
        }
      }
      
      // Si aucun résultat local, retourner vide pour éviter les coûts API
      return {
        chunks: [],
        processingTime: performance.now() - startTime,
        model: 'local',
        totalTokens: 0,
        optimizationApplied: ['no-results']
      };
      
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  return {
    searchMemories,
    loading
  };
};

// Optimisation de chunk pour réduire les tokens
function optimizeChunk(content: string, maxSize: number): string {
  if (!content || content.length <= maxSize) return content;
  
  // Stratégies d'optimisation:
  // 1. Supprimer les répétitions
  const lines = content.split('\n').filter(Boolean);
  const uniqueLines = [...new Set(lines)];
  let optimized = uniqueLines.join(' ');
  
  // 2. Supprimer les mots de remplissage excessifs
  const fillerWords = ['euh', 'hein', 'donc', 'en fait', 'tu vois', 'voilà'];
  fillerWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    optimized = optimized.replace(regex, '');
  });
  
  // 3. Nettoyer les espaces
  optimized = optimized.replace(/\s+/g, ' ').trim();
  
  // 4. Truncature intelligente si encore trop long
  if (optimized.length > maxSize) {
    // Essayer de couper à une phrase complète
    const sentences = optimized.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      if ((result + sentence).length > maxSize - 10) break;
      result += sentence + '. ';
    }
    
    if (result.length > 50) {
      return result.trim();
    } else {
      // Fallback: coupe brutale
      return optimized.slice(0, maxSize - 3) + '...';
    }
  }
  
  return optimized;
}

// Déduplication des chunks similaires
function deduplicateChunks(chunks: Array<{id: string, content: string, score: number, source: string}>) {
  const deduplicated: typeof chunks = [];
  
  for (const chunk of chunks) {
    const isDuplicate = deduplicated.some(existing => {
      // Similarité de contenu (Jaccard simple)
      const similarity = calculateJaccardSimilarity(
        chunk.content.toLowerCase(),
        existing.content.toLowerCase()
      );
      return similarity > 0.8; // 80% de similarité = doublon
    });
    
    if (!isDuplicate) {
      deduplicated.push(chunk);
    }
  }
  
  return deduplicated;
}

// Re-ranking basé sur la pertinence contextuelle
async function rerankChunks(
  query: string, 
  chunks: Array<{id: string, content: string, score: number, source: string}>
): Promise<typeof chunks> {
  // Pour une version gratuite, utiliser un re-ranking local simple
  const queryWords = query.toLowerCase().split(/\s+/);
  
  return chunks
    .map(chunk => {
      // Score de re-ranking basé sur:
      // 1. Correspondance exacte des termes
      const exactMatches = queryWords.filter(word => 
        chunk.content.toLowerCase().includes(word)
      ).length;
      
      // 2. Proximité des termes de recherche
      let proximityScore = 0;
      if (queryWords.length > 1) {
        const content = chunk.content.toLowerCase();
        for (let i = 0; i < queryWords.length - 1; i++) {
          const word1Pos = content.indexOf(queryWords[i]);
          const word2Pos = content.indexOf(queryWords[i + 1]);
          if (word1Pos > -1 && word2Pos > -1) {
            const distance = Math.abs(word2Pos - word1Pos);
            proximityScore += 1 / (1 + distance / 100); // Plus proche = meilleur score
          }
        }
      }
      
      // 3. Longueur du contenu (ni trop court ni trop long)
      const lengthScore = chunk.content.length > 50 && chunk.content.length < 1000 ? 0.1 : 0;
      
      const newScore = chunk.score + (exactMatches * 0.3) + (proximityScore * 0.2) + lengthScore;
      
      return {
        ...chunk,
        score: newScore
      };
    })
    .sort((a, b) => b.score - a.score);
}

// Similarité Jaccard simplifiée
function calculateJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Estimation de tokens (approximative)
function estimateTokens(text: string): number {
  // Règle approximative: 1 token ≈ 4 caractères pour le français
  return Math.ceil(text.length / 4);
}

// Génération d'embedding pour la requête (mockée pour local)
async function getQueryEmbedding(query: string): Promise<number[]> {
  // En production, ceci devrait appeler un service d'embedding
  // Pour le moment, retourner un embedding factice
  const mockEmbedding = new Array(1536).fill(0).map(() => Math.random() - 0.5);
  return mockEmbedding;
}