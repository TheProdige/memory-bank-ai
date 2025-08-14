import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { analyzeComplexity, type ComplexityAnalysis } from '@/lib/complexityDetector';
import { 
  generateLocalSummary, 
  categorizeLocally, 
  validateLocalResult,
  type LocalModelResult,
  type LocalCategorizationResult 
} from '@/lib/localModels';
import { transcribeAudioLocal } from '@/hooks/useLocalTranscription';

interface HybridResult {
  result: any;
  model: 'local' | 'api';
  complexity: ComplexityAnalysis;
  processingTime: number;
  cost: number; // USD
  fallbackReason?: string;
}

interface HybridOptions {
  forceModel?: 'local' | 'api';
  userTier?: 'free' | 'pro';
  enableFallback?: boolean;
  maxRetries?: number;
}

export const useHybridProcessing = () => {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({
    localCalls: 0,
    apiCalls: 0,
    totalSaved: 0, // USD économisé
    avgComplexity: 0
  });

  // Transcription hybride
  const transcribeAudio = useCallback(async (
    audioBlob: Blob,
    options: HybridOptions & { languageHint?: 'fr' | 'en' | 'auto' } = {}
  ): Promise<HybridResult> => {
    const startTime = performance.now();
    setProcessing(true);

    try {
      // Analyse de complexité basée sur la durée audio
      const duration = audioBlob.size / (16000 * 2); // Estimation grossière
      const complexity = analyzeComplexity('', {
        hasAudio: true,
        duration,
        userTier: options.userTier
      });

      // Essayer d'abord local si approprié
      if (!options.forceModel || options.forceModel === 'local') {
        if (complexity.suggestedModel === 'local' || options.userTier === 'free') {
          try {
            const localResult = await transcribeAudioLocal(audioBlob, {
              languageHint: options.languageHint || 'auto',
              onProgress: (progress) => console.log(`Transcription locale: ${progress}%`)
            });

            const validation = validateLocalResult(
              {
                text: localResult.text,
                confidence: 0.8,
                model: 'whisper-local',
                processingTime: localResult.elapsedMs
              },
              'summary',
              complexity.score
            );

            if (validation.isValid || !options.enableFallback) {
              setStats(prev => ({ ...prev, localCalls: prev.localCalls + 1 }));
              return {
                result: localResult,
                model: 'local',
                complexity,
                processingTime: performance.now() - startTime,
                cost: 0
              };
            }
          } catch (localError) {
            console.warn('Transcription locale échouée:', localError);
            if (!options.enableFallback) throw localError;
          }
        }
      }

      // Fallback vers API
      if (options.forceModel !== 'local') {
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { 
            audio: await blobToBase64(audioBlob),
            language: options.languageHint 
          }
        });

        if (error) throw error;

        setStats(prev => ({ ...prev, apiCalls: prev.apiCalls + 1 }));
        
        return {
          result: data,
          model: 'api',
          complexity,
          processingTime: performance.now() - startTime,
          cost: estimateTranscriptionCost(duration),
          fallbackReason: 'Complexité élevée ou échec local'
        };
      }

      throw new Error('Aucun modèle disponible');

    } finally {
      setProcessing(false);
    }
  }, [user]);

  // Résumé hybride
  const generateSummary = useCallback(async (
    text: string,
    options: HybridOptions & { style?: 'concise' | 'detailed' | 'bullet-points' } = {}
  ): Promise<HybridResult> => {
    const startTime = performance.now();
    setProcessing(true);

    try {
      const complexity = analyzeComplexity(text, { userTier: options.userTier });

      // Essayer d'abord local
      if (!options.forceModel || options.forceModel === 'local') {
        if (complexity.suggestedModel === 'local' || options.userTier === 'free') {
          const localResult = generateLocalSummary(text, {
            maxLength: 200,
            style: options.style || 'concise'
          });

          const validation = validateLocalResult(localResult, 'summary', complexity.score);

          if (validation.isValid || !options.enableFallback) {
            setStats(prev => ({ 
              ...prev, 
              localCalls: prev.localCalls + 1,
              totalSaved: prev.totalSaved + 0.002 // ~$0.002 économisé
            }));

            return {
              result: { summary: localResult.text, confidence: localResult.confidence },
              model: 'local',
              complexity,
              processingTime: performance.now() - startTime,
              cost: 0
            };
          }
        }
      }

      // Fallback vers API
      if (options.forceModel !== 'local') {
        const { data, error } = await supabase.functions.invoke('ai-gateway', {
          body: {
            operation: 'summarize',
            input: text,
            params: { style: options.style }
          }
        });

        if (error) throw error;

        setStats(prev => ({ ...prev, apiCalls: prev.apiCalls + 1 }));

        return {
          result: data,
          model: 'api',
          complexity,
          processingTime: performance.now() - startTime,
          cost: estimateTextCost(text),
          fallbackReason: 'Complexité élevée ou échec local'
        };
      }

      throw new Error('Aucun modèle disponible');

    } finally {
      setProcessing(false);
    }
  }, [user]);

  // Catégorisation hybride
  const categorizeMemory = useCallback(async (
    text: string,
    options: HybridOptions = {}
  ): Promise<HybridResult> => {
    const startTime = performance.now();
    setProcessing(true);

    try {
      const complexity = analyzeComplexity(text, { userTier: options.userTier });

      // Local d'abord pour les cas simples
      if (!options.forceModel || options.forceModel === 'local') {
        if (complexity.score < 0.6 || options.userTier === 'free') {
          const localResult = categorizeLocally(text);
          
          if (localResult.confidence > 0.4 || !options.enableFallback) {
            setStats(prev => ({ 
              ...prev, 
              localCalls: prev.localCalls + 1,
              totalSaved: prev.totalSaved + 0.001
            }));

            return {
              result: localResult,
              model: 'local',
              complexity,
              processingTime: performance.now() - startTime,
              cost: 0
            };
          }
        }
      }

      // API pour les cas complexes
      if (options.forceModel !== 'local') {
        const { data, error } = await supabase.functions.invoke('ai-gateway', {
          body: {
            operation: 'categorize',
            input: text
          }
        });

        if (error) throw error;

        setStats(prev => ({ ...prev, apiCalls: prev.apiCalls + 1 }));

        return {
          result: data,
          model: 'api',
          complexity,
          processingTime: performance.now() - startTime,
          cost: estimateTextCost(text),
          fallbackReason: 'Complexité élevée ou échec local'
        };
      }

      throw new Error('Aucun modèle disponible');

    } finally {
      setProcessing(false);
    }
  }, [user]);

  return {
    transcribeAudio,
    generateSummary,
    categorizeMemory,
    processing,
    stats
  };
};

// Helpers
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function estimateTranscriptionCost(durationSeconds: number): number {
  // OpenAI Whisper: $0.006 per minute
  return (durationSeconds / 60) * 0.006;
}

function estimateTextCost(text: string): number {
  // Estimation GPT-4o-mini: ~$0.0001 per 1K tokens
  const tokens = text.length / 4; // Approximation 4 chars = 1 token
  return (tokens / 1000) * 0.0001;
}