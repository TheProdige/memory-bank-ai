// Hook pour la gestion du cache d'embeddings avec optimisations anti-coût
import { useState, useCallback, useEffect } from 'react';
import { Logger } from '@/core/logging/Logger';
import { costEnforcer } from '@/core/ai/CostEnforcer';

export interface CachedEmbedding {
  id: string;
  text: string;
  textHash: string;
  embedding: number[];
  model: string;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
}

export interface EmbeddingRequest {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high';
  model?: string;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
  topHits: CachedEmbedding[];
}

const CACHE_KEY = 'echovault_embedding_cache';
const MAX_CACHE_SIZE = 1000; // Limite d'entrées
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 heure

export const useEmbeddingCache = () => {
  const [cache, setCache] = useState<Map<string, CachedEmbedding>>(new Map());
  const [stats, setStats] = useState<CacheStats>({
    totalEntries: 0,
    hitRate: 0,
    memoryUsage: 0,
    oldestEntry: 0,
    newestEntry: 0,
    topHits: []
  });
  const [batchQueue, setBatchQueue] = useState<EmbeddingRequest[]>([]);

  // Initialisation du cache depuis localStorage
  useEffect(() => {
    loadCacheFromStorage();
    const cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Sauvegarde automatique du cache
  useEffect(() => {
    saveCacheToStorage();
    updateStats();
  }, [cache]);

  // Recherche d'embedding dans le cache
  const getCachedEmbedding = useCallback((text: string, model: string = 'default'): number[] | null => {
    const textHash = generateTextHash(text);
    const cacheKey = `${model}_${textHash}`;
    const cached = cache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Vérifier l'expiration
    if (Date.now() > cached.timestamp + cached.ttl) {
      cache.delete(cacheKey);
      setCache(new Map(cache));
      return null;
    }
    
    // Mettre à jour les stats d'accès
    cached.hitCount++;
    cached.lastAccessed = Date.now();
    setCache(new Map(cache.set(cacheKey, cached)));
    
    Logger.info('Embedding cache hit', { 
      textHash, 
      model, 
      hitCount: cached.hitCount 
    });
    
    return cached.embedding;
  }, [cache]);

  // Mise en cache d'un embedding
  const cacheEmbedding = useCallback((
    text: string, 
    embedding: number[], 
    model: string = 'default',
    ttl: number = DEFAULT_TTL
  ): void => {
    const textHash = generateTextHash(text);
    const cacheKey = `${model}_${textHash}`;
    
    const entry: CachedEmbedding = {
      id: generateId(),
      text: text.slice(0, 200), // Stocker seulement un extrait pour debug
      textHash,
      embedding,
      model,
      timestamp: Date.now(),
      ttl,
      hitCount: 0,
      lastAccessed: Date.now()
    };
    
    // Vérifier la limite de taille du cache
    if (cache.size >= MAX_CACHE_SIZE) {
      evictLeastUsed();
    }
    
    setCache(new Map(cache.set(cacheKey, entry)));
    
    Logger.info('Embedding cached', { 
      textHash, 
      model, 
      embeddingSize: embedding.length,
      cacheSize: cache.size + 1
    });
  }, [cache]);

  // Génération d'embeddings avec gestion de batch
  const getOrGenerateEmbedding = useCallback(async (
    text: string,
    model: string = 'default',
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<number[]> => {
    // 1. Vérifier le cache d'abord
    const cached = getCachedEmbedding(text, model);
    if (cached) {
      return cached;
    }
    
    // 2. Vérifier les contraintes de coût
    const costDecision = await costEnforcer.shouldProceed(
      'generate_embedding',
      estimateTokens(text),
      estimateEmbeddingCost(text, model),
      priority
    );
    
    if (!costDecision.allowed) {
      if (costDecision.suggestedAction === 'defer' && priority === 'low') {
        // Ajouter au batch pour traitement différé
        return addToBatch(text, model, priority);
      } else {
        throw new Error(`Embedding generation blocked: ${costDecision.reason}`);
      }
    }
    
    // 3. Générer l'embedding
    return generateEmbedding(text, model);
  }, [getCachedEmbedding]);

  // Traitement par batch
  const addToBatch = useCallback(async (
    text: string,
    model: string,
    priority: 'low' | 'medium' | 'high'
  ): Promise<number[]> => {
    const request: EmbeddingRequest = {
      id: generateId(),
      text,
      priority,
      model
    };
    
    setBatchQueue(prev => [...prev, request]);
    
    // Retourner un embedding placeholder ou attendre le batch
    return new Promise((resolve, reject) => {
      // Simuler un embedding de base en attendant
      const mockEmbedding = generateMockEmbedding(text);
      resolve(mockEmbedding);
    });
  }, []);

  // Traitement du batch d'embeddings
  const processBatch = useCallback(async (): Promise<void> => {
    if (batchQueue.length === 0) return;
    
    Logger.info('Processing embedding batch', { queueSize: batchQueue.length });
    
    const batch = [...batchQueue];
    setBatchQueue([]);
    
    // Grouper par modèle pour optimiser
    const byModel = batch.reduce((acc, req) => {
      const model = req.model || 'default';
      if (!acc[model]) acc[model] = [];
      acc[model].push(req);
      return acc;
    }, {} as Record<string, EmbeddingRequest[]>);
    
    // Traiter chaque groupe
    for (const [model, requests] of Object.entries(byModel)) {
      try {
        await processBatchByModel(requests, model);
      } catch (error) {
        Logger.error('Batch processing failed', { error, model, count: requests.length });
      }
    }
  }, [batchQueue]);

  // Génération d'embedding (local ou API)
  const generateEmbedding = useCallback(async (
    text: string, 
    model: string
  ): Promise<number[]> => {
    try {
      // Pour le MVP, utiliser des embeddings locaux simples
      const embedding = await generateLocalEmbedding(text);
      
      // Mettre en cache le résultat
      cacheEmbedding(text, embedding, model);
      
      return embedding;
    } catch (error) {
      Logger.error('Embedding generation failed', { error, text: text.slice(0, 50) });
      throw error;
    }
  }, [cacheEmbedding]);

  // Nettoyage des entrées expirées
  const cleanupExpiredEntries = useCallback((): void => {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      setCache(new Map(cache));
      Logger.info('Cache cleanup completed', { 
        entriesRemoved: cleanedCount,
        remainingEntries: cache.size 
      });
    }
  }, [cache]);

  // Éviction des entrées les moins utilisées
  const evictLeastUsed = useCallback((): void => {
    const entries = Array.from(cache.entries());
    
    // Trier par score (combinaison de hitCount et lastAccessed)
    entries.sort(([, a], [, b]) => {
      const scoreA = a.hitCount + (Date.now() - a.lastAccessed) / (24 * 60 * 60 * 1000);
      const scoreB = b.hitCount + (Date.now() - b.lastAccessed) / (24 * 60 * 60 * 1000);
      return scoreA - scoreB;
    });
    
    // Supprimer les 10% les moins utilisées
    const toRemove = Math.floor(cache.size * 0.1);
    for (let i = 0; i < toRemove; i++) {
      if (entries[i]) {
        cache.delete(entries[i][0]);
      }
    }
    
    setCache(new Map(cache));
    
    Logger.info('Cache eviction completed', { 
      entriesRemoved: toRemove,
      remainingEntries: cache.size 
    });
  }, [cache]);

  // Chargement du cache depuis localStorage
  const loadCacheFromStorage = useCallback((): void => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const loadedCache = new Map<string, CachedEmbedding>();
        
        data.forEach((entry: CachedEmbedding, key: string) => {
          // Vérifier que l'entrée n'est pas expirée
          if (Date.now() <= entry.timestamp + entry.ttl) {
            loadedCache.set(key, entry);
          }
        });
        
        setCache(loadedCache);
        Logger.info('Cache loaded from storage', { entries: loadedCache.size });
      }
    } catch (error) {
      Logger.error('Failed to load cache from storage', { error });
    }
  }, []);

  // Sauvegarde du cache vers localStorage
  const saveCacheToStorage = useCallback((): void => {
    try {
      const data = Array.from(cache.entries());
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      Logger.error('Failed to save cache to storage', { error });
    }
  }, [cache]);

  // Mise à jour des statistiques
  const updateStats = useCallback((): void => {
    const entries = Array.from(cache.values());
    
    if (entries.length === 0) {
      setStats({
        totalEntries: 0,
        hitRate: 0,
        memoryUsage: 0,
        oldestEntry: 0,
        newestEntry: 0,
        topHits: []
      });
      return;
    }
    
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const totalRequests = totalHits + entries.length; // Approximation
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    
    const memoryUsage = entries.reduce((sum, entry) => {
      return sum + (entry.embedding.length * 8) + (entry.text.length * 2);
    }, 0);
    
    const timestamps = entries.map(e => e.timestamp);
    const oldestEntry = Math.min(...timestamps);
    const newestEntry = Math.max(...timestamps);
    
    const topHits = entries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5);
    
    setStats({
      totalEntries: entries.length,
      hitRate,
      memoryUsage,
      oldestEntry,
      newestEntry,
      topHits
    });
  }, [cache]);

  return {
    // Fonctions principales
    getCachedEmbedding,
    cacheEmbedding,
    getOrGenerateEmbedding,
    processBatch,
    
    // Gestion du cache
    cleanupExpiredEntries,
    evictLeastUsed,
    clearCache: useCallback(() => {
      setCache(new Map());
      localStorage.removeItem(CACHE_KEY);
    }, []),
    
    // État et statistiques
    stats,
    batchQueueSize: batchQueue.length,
    cacheSize: cache.size,
    
    // Utilitaires
    exportCache: useCallback(() => Array.from(cache.entries()), [cache]),
    importCache: useCallback((data: [string, CachedEmbedding][]) => {
      setCache(new Map(data));
    }, [])
  };
};

// Fonctions utilitaires

function generateTextHash(text: string): string {
  // Hash simple pour identifier uniquement un texte
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir en 32-bit integer
  }
  return hash.toString(36);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateEmbeddingCost(text: string, model: string): number {
  const tokens = estimateTokens(text);
  return tokens * 0.0001; // Coût approximatif
}

async function generateLocalEmbedding(text: string): Promise<number[]> {
  // Embedding local simple basé sur TF-IDF et mots-clés
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  // Créer un vecteur de dimension fixe
  const dimension = 384; // Dimension compatible avec les modèles standards
  const embedding = new Array(dimension).fill(0);
  
  // Remplir avec des valeurs basées sur les mots
  words.forEach((word, index) => {
    const hash = generateTextHash(word);
    const position = Math.abs(parseInt(hash, 36)) % dimension;
    embedding[position] += 1 / Math.sqrt(words.length);
  });
  
  // Normaliser le vecteur
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
}

function generateMockEmbedding(text: string): number[] {
  // Embedding de base pour les tests
  const dimension = 384;
  const seed = generateTextHash(text);
  const rng = seedRandom(seed);
  
  return Array.from({ length: dimension }, () => (rng() - 0.5) * 2);
}

function seedRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) & 0xffffffff;
  }
  
  return function() {
    hash = (hash * 1664525 + 1013904223) & 0xffffffff;
    return (hash >>> 0) / 0x100000000;
  };
}

async function processBatchByModel(
  requests: EmbeddingRequest[], 
  model: string
): Promise<void> {
  // Traitement optimisé par lot
  Logger.info('Processing batch by model', { model, count: requests.length });
  
  for (const request of requests) {
    try {
      await generateLocalEmbedding(request.text);
    } catch (error) {
      Logger.error('Batch item processing failed', { error, requestId: request.id });
    }
  }
}