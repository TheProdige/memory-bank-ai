/**
 * Utility methods for RAG Orchestrator
 */

import { RerankedChunk, Source, QueryFilters, RAGOptions, IntentAnalysis } from './RAGTypes';

export class RAGUtilityMethods {
  static handleCostLimitation(costDecision: any, query: string): any {
    return {
      answer: `Limite de coût atteinte. Raison: ${costDecision.reason}`,
      citations: [],
      confidence: 0,
      answerability: 0,
      sources: [],
      metadata: {
        requestId: 'cost_limited',
        processingTime: 0,
        model: 'cost-enforcer',
        tokensUsed: 0,
        cost: 0,
        retrievalStats: { totalCandidates: 0, afterRerank: 0, strategy: 'blocked' }
      }
    };
  }

  static handleNoResults(query: string, requestId: string): any {
    return {
      answer: "Je n'ai pas trouvé d'informations pertinentes pour répondre à votre question.",
      citations: [],
      confidence: 0,
      answerability: 0,
      sources: [],
      metadata: {
        requestId,
        processingTime: 0,
        model: 'no-results',
        tokensUsed: 0,
        cost: 0,
        retrievalStats: { totalCandidates: 0, afterRerank: 0, strategy: 'none' }
      }
    };
  }

  static extractSources(chunks: RerankedChunk[]): Source[] {
    return chunks.map(chunk => ({
      id: chunk.id,
      title: chunk.source,
      content: chunk.content.slice(0, 200),
      url: undefined
    }));
  }

  static async cacheResponse(query: string, response: any, userId: string): Promise<void> {
    // Cache implementation would go here
  }

  static determineScope(query: string, context?: any): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const scope = [];
    
    if (words.some(w => ['quand', 'date', 'année'].includes(w))) scope.push('temporal');
    if (words.some(w => ['qui', 'personne', 'auteur'].includes(w))) scope.push('entity');
    if (words.some(w => ['metadata', 'source', 'fichier'].includes(w))) scope.push('metadata');
    
    return scope.length > 0 ? scope : ['general'];
  }

  static extractEntities(query: string): string[] {
    // Simple entity extraction
    const words = query.split(/\s+/);
    return words.filter(word => 
      word.length > 3 && 
      /^[A-Z]/.test(word) // Starts with capital
    );
  }

  static extractTemporal(query: string): any {
    const timeWords = ['aujourd\'hui', 'hier', 'demain', 'semaine', 'mois', 'année'];
    if (timeWords.some(word => query.toLowerCase().includes(word))) {
      return {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      };
    }
    return undefined;
  }

  static predictAnswerType(query: string, type: string): string {
    if (query.includes('liste') || query.includes('énumérer')) return 'list';
    if (query.includes('compare') || query.includes('différence')) return 'comparison';
    if (query.includes('comment') || query.includes('expliquer')) return 'explanation';
    if (query.includes('étapes') || query.includes('processus')) return 'process';
    return 'short';
  }

  static estimateTokens(input: any): number {
    if (typeof input === 'string') {
      return Math.ceil(input.length / 4); // Rough approximation
    }
    if (input.query) {
      return Math.ceil(input.query.length / 4);
    }
    return 100; // Default estimate
  }

  static estimateCost(intent: IntentAnalysis, tokens: number): number {
    const costPerToken = intent.complexity > 0.7 ? 0.00003 : 0.00001; // Higher cost for complex queries
    return tokens * costPerToken;
  }

  static selectRetrievalStrategy(intent: IntentAnalysis): string {
    if (intent.type === 'temporal') return 'temporal';
    if (intent.entities.length > 0) return 'entity-focused';
    if (intent.complexity > 0.8) return 'hybrid';
    return 'semantic';
  }

  static computeTopK(intent: IntentAnalysis, strategy: string): number {
    if (intent.complexity > 0.8) return 8;
    if (strategy === 'hybrid') return 6;
    return 4;
  }

  static buildFilters(intent: IntentAnalysis, options?: RAGOptions): QueryFilters {
    return {
      categories: intent.scope.includes('general') ? undefined : intent.scope,
      minScore: options?.threshold || 0.6
    };
  }

  static generateSuggestedQueries(query: string): string[] {
    return [
      `Pouvez-vous reformuler votre question sur "${query.slice(0, 30)}..." ?`,
      "Essayez d'être plus spécifique dans votre demande",
      "Vérifiez que les informations recherchées sont dans vos documents"
    ];
  }

  static computeCoverageScore(query: string, chunks: RerankedChunk[]): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const coveredTerms = new Set();
    
    chunks.forEach(chunk => {
      const content = chunk.content.toLowerCase();
      queryTerms.forEach(term => {
        if (content.includes(term)) coveredTerms.add(term);
      });
    });
    
    return coveredTerms.size / queryTerms.length;
  }

  static computeCoherenceScore(chunks: RerankedChunk[]): number {
    if (chunks.length < 2) return 1;
    
    // Simple coherence based on source diversity and content overlap
    const sources = new Set(chunks.map(c => c.source));
    const sourceDiv = sources.size / chunks.length;
    
    return Math.min(1, sourceDiv * 0.7 + 0.3); // Balanced coherence score
  }

  static explainAnswerability(evidenceScore: number, coverageScore: number, coherenceScore: number): string {
    if (evidenceScore < 0.4) return "Preuves insuffisantes dans les sources";
    if (coverageScore < 0.5) return "La question couvre des aspects non documentés";
    if (coherenceScore < 0.4) return "Sources contradictoires ou incohérentes";
    return "Sources suffisantes et cohérentes trouvées";
  }

  static identifyMissingInfo(query: string, chunks: RerankedChunk[]): string[] {
    const missing = [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    queryTerms.forEach(term => {
      const found = chunks.some(chunk => 
        chunk.content.toLowerCase().includes(term)
      );
      if (!found) missing.push(term);
    });
    
    return missing.slice(0, 3); // Limit to 3 missing terms
  }

  static async generateFingerprint(query: string): Promise<string> {
    // Simple hash for caching
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}