// Module central pour l'application de la politique anti-coût
import { Logger } from '@/core/logging/Logger';

export interface CostConstraints {
  dailyBudgetUSD: number;
  dailyTokensMax: number;
  requestRateLimit: number; // requests per minute
  maxRetries: number;
  enableCaching: boolean;
  enableBatching: boolean;
}

export interface UsageStats {
  dailySpent: number;
  dailyTokens: number;
  requestsInLastMinute: number;
  cacheHitRate: number;
  batchEfficiency: number;
}

export interface CostDecision {
  allowed: boolean;
  reason: string;
  suggestedAction: 'proceed' | 'defer' | 'degrade' | 'cache' | 'local';
  estimatedCost: number;
  alternatives?: string[];
}

export class CostEnforcer {
  private static instance: CostEnforcer;
  private constraints: CostConstraints;
  private cache = new Map<string, any>();
  private requestHistory: number[] = [];
  private batchQueue: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.constraints = {
      dailyBudgetUSD: 5.0, // Budget par défaut très bas
      dailyTokensMax: 100000,
      requestRateLimit: 10,
      maxRetries: 2,
      enableCaching: true,
      enableBatching: true
    };
  }

  public static getInstance(): CostEnforcer {
    if (!CostEnforcer.instance) {
      CostEnforcer.instance = new CostEnforcer();
    }
    return CostEnforcer.instance;
  }

  // Configuration dynamique des contraintes
  public setConstraints(constraints: Partial<CostConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints };
    Logger.info('CostEnforcer constraints updated', { constraints: this.constraints });
  }

  // Décision d'autoriser ou non une opération
  public async shouldProceed(
    operation: string,
    estimatedTokens: number,
    estimatedCost: number,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<CostDecision> {
    const usage = await this.getCurrentUsage();
    
    // Vérifications des limites
    const budgetExceeded = usage.dailySpent + estimatedCost > this.constraints.dailyBudgetUSD;
    const tokensExceeded = usage.dailyTokens + estimatedTokens > this.constraints.dailyTokensMax;
    const rateLimited = usage.requestsInLastMinute >= this.constraints.requestRateLimit;

    // Cache check
    const cacheKey = this.generateCacheKey(operation, estimatedTokens);
    if (this.constraints.enableCaching && this.cache.has(cacheKey)) {
      return {
        allowed: true,
        reason: 'Cache hit - coût zéro',
        suggestedAction: 'cache',
        estimatedCost: 0,
        alternatives: []
      };
    }

    // Politique de dégradation selon la priorité
    if (budgetExceeded || tokensExceeded) {
      const alternatives = [];
      
      if (priority === 'low') {
        alternatives.push('Différer à demain', 'Utiliser un modèle local');
        return {
          allowed: false,
          reason: `Budget dépassé (${usage.dailySpent.toFixed(3)}/${this.constraints.dailyBudgetUSD})`,
          suggestedAction: 'defer',
          estimatedCost,
          alternatives
        };
      }
      
      if (priority === 'medium') {
        alternatives.push('Réduire la taille du contexte', 'Batching différé');
        return {
          allowed: false,
          reason: 'Budget proche de la limite - dégradation',
          suggestedAction: 'degrade',
          estimatedCost: estimatedCost * 0.3, // Coût réduit
          alternatives
        };
      }
    }

    if (rateLimited && priority !== 'high') {
      return {
        allowed: false,
        reason: `Rate limit atteint (${usage.requestsInLastMinute}/${this.constraints.requestRateLimit})`,
        suggestedAction: 'defer',
        estimatedCost,
        alternatives: ['Attendre 1 minute', 'Utiliser le cache']
      };
    }

    // Batching pour les opérations non urgentes
    if (this.constraints.enableBatching && priority === 'low' && this.batchQueue.length < 10) {
      this.addToBatch(operation, estimatedTokens, estimatedCost);
      return {
        allowed: false,
        reason: 'Ajouté au batch pour optimisation',
        suggestedAction: 'defer',
        estimatedCost: estimatedCost * 0.7, // Réduction de coût par batching
        alternatives: ['Traitement immédiat (coût plein)']
      };
    }

    // Autorisé avec tracking
    this.trackRequest(estimatedCost, estimatedTokens);
    return {
      allowed: true,
      reason: 'Dans les limites budgétaires',
      suggestedAction: 'proceed',
      estimatedCost,
      alternatives: []
    };
  }

  // Mise en cache des résultats
  public cacheResult(operation: string, tokens: number, result: any, ttl: number = 3600000): void {
    if (!this.constraints.enableCaching) return;
    
    const key = this.generateCacheKey(operation, tokens);
    const entry = {
      result,
      timestamp: Date.now(),
      ttl
    };
    
    this.cache.set(key, entry);
    
    // Nettoyage automatique des entrées expirées
    setTimeout(() => {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp > ttl) {
        this.cache.delete(key);
      }
    }, ttl);
    
    Logger.info('Result cached', { operation, tokens, cacheSize: this.cache.size });
  }

  // Récupération depuis le cache
  public getCached(operation: string, tokens: number): any | null {
    if (!this.constraints.enableCaching) return null;
    
    const key = this.generateCacheKey(operation, tokens);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Vérifier expiration
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    Logger.info('Cache hit', { operation, tokens });
    return cached.result;
  }

  // Ajout au batch pour traitement différé
  private addToBatch(operation: string, tokens: number, cost: number): void {
    this.batchQueue.push({ operation, tokens, cost, timestamp: Date.now() });
    
    // Traitement du batch toutes les 15 minutes ou quand plein
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, 15 * 60 * 1000); // 15 minutes
    }
    
    // Traitement immédiat si batch plein
    if (this.batchQueue.length >= 20) {
      this.processBatch();
    }
  }

  // Traitement du batch
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    const totalCost = batch.reduce((sum, item) => sum + item.cost, 0);
    const totalTokens = batch.reduce((sum, item) => sum + item.tokens, 0);
    
    Logger.info('Processing batch', { 
      items: batch.length, 
      totalCost, 
      totalTokens,
      savings: `${((batch.length - 1) * 0.3 * totalCost).toFixed(3)}$`
    });
    
    // Ici, implémenter le traitement réel du batch
    // Par exemple, grouper les embeddings, résumés, etc.
  }

  // Statistiques d'usage actuel
  private async getCurrentUsage(): Promise<UsageStats> {
    const today = new Date().toDateString();
    
    // Récupérer depuis localStorage ou API
    const dailySpent = parseFloat(localStorage.getItem(`usage_${today}_spent`) || '0');
    const dailyTokens = parseInt(localStorage.getItem(`usage_${today}_tokens`) || '0');
    
    // Nettoyer l'historique des requêtes (garder seulement la dernière minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter(timestamp => timestamp > oneMinuteAgo);
    
    const cacheHitRate = this.cache.size > 0 ? 0.85 : 0; // Approximation
    const batchEfficiency = this.batchQueue.length > 0 ? 0.7 : 1;
    
    return {
      dailySpent,
      dailyTokens,
      requestsInLastMinute: this.requestHistory.length,
      cacheHitRate,
      batchEfficiency
    };
  }

  // Tracking d'une requête
  private trackRequest(cost: number, tokens: number): void {
    const now = Date.now();
    const today = new Date().toDateString();
    
    // Mettre à jour les statistiques
    const currentSpent = parseFloat(localStorage.getItem(`usage_${today}_spent`) || '0');
    const currentTokens = parseInt(localStorage.getItem(`usage_${today}_tokens`) || '0');
    
    localStorage.setItem(`usage_${today}_spent`, (currentSpent + cost).toString());
    localStorage.setItem(`usage_${today}_tokens`, (currentTokens + tokens).toString());
    
    // Ajouter à l'historique des requêtes
    this.requestHistory.push(now);
    
    Logger.info('Request tracked', { cost, tokens, dailySpent: currentSpent + cost });
  }

  // Génération de clé de cache
  private generateCacheKey(operation: string, tokens: number): string {
    return `${operation}_${tokens}_${Date.now().toString().slice(0, -5)}`; // Précision à 10 secondes
  }

  // Nettoyage du cache
  public clearCache(): void {
    this.cache.clear();
    Logger.info('Cache cleared');
  }

  // Statistiques pour le dashboard
  public async getStats(): Promise<UsageStats> {
    return this.getCurrentUsage();
  }

  // Réinitialisation quotidienne
  public resetDailyLimits(): void {
    const today = new Date().toDateString();
    localStorage.removeItem(`usage_${today}_spent`);
    localStorage.removeItem(`usage_${today}_tokens`);
    this.requestHistory = [];
    Logger.info('Daily limits reset');
  }
}

// Export singleton
export const costEnforcer = CostEnforcer.getInstance();