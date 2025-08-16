/**
 * Enhanced Local Models - Production-grade local processing with validation
 */

import { Logger } from '@/core/logging/Logger';

export interface LocalModelResult {
  text: string;
  confidence: number;
  model: string;
  processingTime: number;
  fallbackReason?: string;
  validationScore?: number;
}

export interface LocalEmbeddingResult {
  embedding: number[];
  confidence: number;
  model: string;
  processingTime: number;
  dimensions: number;
}

export interface AnswerabilityResult {
  canAnswer: boolean;
  confidence: number;
  reasoning: string;
  evidenceScore: number;
  coverageScore: number;
  missingConcepts?: string[];
}

export class EnhancedLocalModels {
  private embeddingCache = new Map<string, LocalEmbeddingResult>();
  private summaryCache = new Map<string, LocalModelResult>();
  private answerabilityModel = new LocalAnswerabilityModel();
  
  // Enhanced local summarization with quality validation
  generateLocalSummary(
    text: string,
    options: LocalSummaryOptions = {}
  ): LocalModelResult {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('summary', text, options);
    
    // Check cache first
    const cached = this.summaryCache.get(cacheKey);
    if (cached) {
      return { ...cached, processingTime: performance.now() - startTime };
    }

    try {
      const {
        maxLength = 150,
        style = 'concise',
        language = 'auto',
        minQuality = 0.6
      } = options;

      if (!text || text.trim().length === 0) {
        return this.createEmptyResult('summary', startTime);
      }

      // Enhanced preprocessing
      const preprocessed = this.preprocessText(text);
      const sentences = this.segmentSentences(preprocessed);
      
      if (sentences.length === 0) {
        return this.createFallbackResult(text, maxLength, startTime);
      }

      // Multi-strategy sentence scoring
      const scoredSentences = this.scoreSentencesAdvanced(sentences, text, language);
      
      // Adaptive selection based on style and length constraints
      const selectedSentences = this.selectSentencesAdaptive(
        scoredSentences,
        maxLength,
        style
      );

      // Generate summary with style-specific formatting
      const summary = this.formatSummary(selectedSentences, style, maxLength);
      
      // Validate quality
      const validationScore = this.validateSummaryQuality(summary, text, sentences);
      
      if (validationScore < minQuality) {
        Logger.warn('Summary quality below threshold', {
          validationScore,
          minQuality,
          textLength: text.length
        });
        
        return this.createFallbackResult(text, maxLength, startTime, 'quality_too_low');
      }

      const result: LocalModelResult = {
        text: summary,
        confidence: Math.min(0.9, 0.5 + (validationScore * 0.4)),
        model: 'enhanced-local-summarizer',
        processingTime: performance.now() - startTime,
        validationScore
      };

      // Cache successful results
      this.summaryCache.set(cacheKey, result);
      
      return result;

    } catch (error) {
      Logger.error('Local summarization failed', { error, textLength: text.length });
      return this.createFallbackResult(text, options.maxLength || 150, startTime, 'processing_error');
    }
  }

  // Enhanced local embeddings with dimension consistency
  async generateLocalEmbedding(
    text: string,
    options: { dimensions?: number; model?: string } = {}
  ): Promise<LocalEmbeddingResult> {
    const startTime = performance.now();
    const { dimensions = 384, model = 'local-tfidf-enhanced' } = options;
    
    const cacheKey = this.generateCacheKey('embedding', text, { dimensions, model });
    const cached = this.embeddingCache.get(cacheKey);
    
    if (cached) {
      return { ...cached, processingTime: performance.now() - startTime };
    }

    try {
      const preprocessed = this.preprocessText(text);
      const terms = this.extractTerms(preprocessed);
      
      if (terms.length === 0) {
        return this.createZeroEmbedding(dimensions, startTime);
      }

      // Enhanced TF-IDF with semantic clustering
      const embedding = this.computeEnhancedEmbedding(terms, dimensions);
      
      // Normalize to unit vector
      const normalizedEmbedding = this.normalizeVector(embedding);
      
      // Compute confidence based on term diversity and coverage
      const confidence = this.computeEmbeddingConfidence(terms, text, normalizedEmbedding);

      const result: LocalEmbeddingResult = {
        embedding: normalizedEmbedding,
        confidence,
        model,
        processingTime: performance.now() - startTime,
        dimensions
      };

      this.embeddingCache.set(cacheKey, result);
      return result;

    } catch (error) {
      Logger.error('Local embedding failed', { error, textLength: text.length });
      return this.createZeroEmbedding(dimensions, startTime);
    }
  }

  // Answerability assessment for RAG quality gate
  async assessAnswerability(
    query: string,
    chunks: Array<{ content: string; score: number }>
  ): Promise<AnswerabilityResult> {
    return this.answerabilityModel.assess(query, chunks);
  }

  // Enhanced preprocessing with language detection
  private preprocessText(text: string): string {
    return text
      // Normalize unicode and encoding issues
      .normalize('NFKD')
      // Remove excessive whitespace but preserve paragraph structure
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      // Fix common OCR/encoding errors
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/…/g, '...')
      // Remove control characters but keep essential punctuation
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
      .trim();
  }

  private segmentSentences(text: string): string[] {
    // Enhanced sentence segmentation that handles edge cases
    return text
      .split(/(?<=[.!?])\s+(?=[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ])/g)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .filter(s => /[.!?]$/.test(s)); // Ensure proper sentence ending
  }

  private scoreSentencesAdvanced(
    sentences: string[],
    fullText: string,
    language: string
  ): Array<{ sentence: string; score: number; features: SentenceFeatures }> {
    const totalSentences = sentences.length;
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / totalSentences;
    
    return sentences.map((sentence, index) => {
      const features = this.extractSentenceFeatures(sentence, index, totalSentences, avgSentenceLength);
      const score = this.computeSentenceScore(features, language);
      
      return { sentence, score, features };
    });
  }

  private extractSentenceFeatures(
    sentence: string,
    position: number,
    totalSentences: number,
    avgLength: number
  ): SentenceFeatures {
    const words = sentence.split(/\s+/);
    const length = words.length;
    
    return {
      length,
      position: position / Math.max(1, totalSentences - 1),
      lengthRatio: length / avgLength,
      hasNumbers: /\d/.test(sentence),
      hasKeywords: this.detectKeywords(sentence),
      complexity: this.computeSentenceComplexity(sentence),
      coherence: this.computeCoherence(sentence),
      informativeness: this.computeInformativeness(words)
    };
  }

  private computeSentenceScore(features: SentenceFeatures, language: string): number {
    const weights = {
      position: language === 'en' ? 0.15 : 0.20, // French summaries often front-load importance
      length: 0.25,
      keywords: 0.30,
      informativeness: 0.20,
      coherence: 0.10
    };

    let score = 0;

    // Position score (beginning and end are important)
    if (features.position < 0.3) score += weights.position;
    else if (features.position > 0.7) score += weights.position * 0.7;

    // Length score (optimal range)
    if (features.lengthRatio >= 0.7 && features.lengthRatio <= 1.5) {
      score += weights.length;
    } else if (features.lengthRatio > 0.5 && features.lengthRatio < 2.0) {
      score += weights.length * 0.5;
    }

    // Keyword presence
    score += features.hasKeywords * weights.keywords;

    // Informativeness
    score += features.informativeness * weights.informativeness;

    // Coherence
    score += features.coherence * weights.coherence;

    // Penalties
    if (features.complexity > 0.8) score *= 0.9; // Penalize overly complex sentences
    if (features.length < 5) score *= 0.5; // Penalize very short sentences

    return Math.max(0, Math.min(1, score));
  }

  private selectSentencesAdaptive(
    scoredSentences: Array<{ sentence: string; score: number; features: SentenceFeatures }>,
    maxLength: number,
    style: string
  ): Array<{ sentence: string; score: number; features: SentenceFeatures }> {
    // Sort by score descending
    const sorted = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    const selected: Array<{ sentence: string; score: number; features: SentenceFeatures }> = [];
    let currentLength = 0;
    
    for (const item of sorted) {
      const sentenceLength = item.sentence.length;
      
      if (currentLength + sentenceLength <= maxLength) {
        selected.push(item);
        currentLength += sentenceLength;
      }
      
      // Stop if we have enough content
      if (selected.length >= 3 && currentLength > maxLength * 0.8) {
        break;
      }
    }
    
    // Sort selected sentences by original position for coherent flow
    return selected.sort((a, b) => a.features.position - b.features.position);
  }

  private formatSummary(
    selectedSentences: Array<{ sentence: string; score: number; features: SentenceFeatures }>,
    style: string,
    maxLength: number
  ): string {
    if (selectedSentences.length === 0) return '';
    
    switch (style) {
      case 'bullet-points':
        return selectedSentences
          .map(item => `• ${item.sentence}`)
          .join('\n');
          
      case 'detailed':
        return selectedSentences
          .map(item => item.sentence)
          .join(' ');
          
      case 'concise':
      default:
        let summary = selectedSentences
          .map(item => item.sentence)
          .join(' ');
          
        // Trim if still too long
        if (summary.length > maxLength) {
          summary = summary.substring(0, maxLength - 3) + '...';
        }
        
        return summary;
    }
  }

  private detectKeywords(sentence: string): number {
    const keywords = [
      // French keywords
      'important', 'essentiel', 'principal', 'majeur', 'crucial', 'fondamental',
      'résultat', 'conclusion', 'donc', 'ainsi', 'par conséquent',
      'premièrement', 'deuxièmement', 'enfin', 'finalement',
      // English keywords
      'important', 'essential', 'main', 'major', 'crucial', 'fundamental',
      'result', 'conclusion', 'therefore', 'thus', 'consequently',
      'first', 'second', 'finally', 'lastly'
    ];
    
    const lowerSentence = sentence.toLowerCase();
    const foundKeywords = keywords.filter(keyword => lowerSentence.includes(keyword));
    
    return Math.min(1, foundKeywords.length / 3); // Normalize to 0-1
  }

  private computeSentenceComplexity(sentence: string): number {
    const words = sentence.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const subordinateClauses = (sentence.match(/[,;:]/g) || []).length;
    
    let complexity = 0;
    
    // Word length complexity
    if (avgWordLength > 6) complexity += 0.3;
    else if (avgWordLength > 4) complexity += 0.1;
    
    // Sentence structure complexity
    complexity += Math.min(0.4, subordinateClauses * 0.1);
    
    // Sentence length complexity
    if (words.length > 20) complexity += 0.3;
    else if (words.length > 15) complexity += 0.1;
    
    return Math.min(1, complexity);
  }

  private computeCoherence(sentence: string): number {
    let coherence = 0.5; // Base coherence
    
    // Check for transition words
    const transitions = ['donc', 'ainsi', 'par conséquent', 'cependant', 'néanmoins', 
                        'therefore', 'thus', 'however', 'nevertheless', 'moreover'];
    const hasTransition = transitions.some(t => sentence.toLowerCase().includes(t));
    if (hasTransition) coherence += 0.2;
    
    // Check for proper sentence structure
    if (/^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/.test(sentence) && /[.!?]$/.test(sentence)) {
      coherence += 0.2;
    }
    
    // Check for balanced punctuation
    const openParens = (sentence.match(/\(/g) || []).length;
    const closeParens = (sentence.match(/\)/g) || []).length;
    if (openParens === closeParens) coherence += 0.1;
    
    return Math.min(1, coherence);
  }

  private computeInformativeness(words: string[]): number {
    // Filter out stop words and short words
    const stopWords = new Set([
      'le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or',
      'the', 'and', 'or', 'but', 'so', 'for', 'nor', 'a', 'an', 'in', 'on', 'at', 'to'
    ]);
    
    const informativeWords = words.filter(word => 
      word.length > 3 && !stopWords.has(word.toLowerCase())
    );
    
    const uniqueWords = new Set(informativeWords.map(w => w.toLowerCase()));
    const diversity = uniqueWords.size / Math.max(1, informativeWords.length);
    
    return Math.min(1, diversity * (informativeWords.length / words.length));
  }

  private computeEnhancedEmbedding(terms: string[], dimensions: number): number[] {
    const embedding = new Array(dimensions).fill(0);
    const termCounts = new Map<string, number>();
    
    // Count term frequencies
    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }

    // Create positional and semantic features
    for (const [term, count] of termCounts) {
      const tf = count / terms.length;
      
      // Multiple hash functions for better distribution
      const hash1 = this.stableHash(term, 1) % dimensions;
      const hash2 = this.stableHash(term, 2) % dimensions;
      const hash3 = this.stableHash(term, 3) % dimensions;
      
      // Distribute signal across multiple dimensions
      embedding[hash1] += tf * 0.6;
      embedding[hash2] += tf * 0.3;
      embedding[hash3] += tf * 0.1;
      
      // Add semantic clustering for similar terms
      if (term.length > 4) {
        const semanticHash = this.stableHash(term.slice(0, -1), 4) % dimensions;
        embedding[semanticHash] += tf * 0.2;
      }
    }

    return embedding;
  }

  private extractTerms(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter(term => /^[a-zàâäéèêëîïôöùûüç]+$/.test(term)); // Only letters
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  private computeEmbeddingConfidence(terms: string[], text: string, embedding: number[]): number {
    let confidence = 0.5; // Base confidence
    
    // Term diversity
    const uniqueTerms = new Set(terms);
    const diversity = uniqueTerms.size / Math.max(1, terms.length);
    confidence += diversity * 0.3;
    
    // Text length appropriateness
    if (text.length >= 20 && text.length <= 1000) {
      confidence += 0.2;
    }
    
    // Embedding magnitude (non-zero indicates meaningful content)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0.1) confidence += 0.2;
    
    return Math.min(0.95, confidence);
  }

  private createZeroEmbedding(dimensions: number, startTime: number): LocalEmbeddingResult {
    return {
      embedding: new Array(dimensions).fill(0),
      confidence: 0,
      model: 'local-tfidf-enhanced',
      processingTime: performance.now() - startTime,
      dimensions
    };
  }

  private stableHash(str: string, seed: number = 0): number {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }

  private validateSummaryQuality(summary: string, originalText: string, sentences: string[]): number {
    let score = 0;

    // Coverage: how much of the original important information is preserved
    const coverage = this.computeCoverage(summary, originalText);
    score += coverage * 0.4;

    // Coherence: how well the summary flows
    const coherence = this.computeTextCoherence(summary);
    score += coherence * 0.3;

    // Conciseness: appropriate compression ratio
    const compressionRatio = summary.length / originalText.length;
    const optimalCompression = compressionRatio >= 0.1 && compressionRatio <= 0.5;
    score += (optimalCompression ? 1 : 0.5) * 0.2;

    // Completeness: summary has proper structure
    const hasProperStructure = /[.!?]$/.test(summary.trim()) && summary.length > 20;
    score += (hasProperStructure ? 1 : 0) * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private computeCoverage(summary: string, originalText: string): number {
    const summaryWords = new Set(summary.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const originalWords = new Set(originalText.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...summaryWords].filter(w => originalWords.has(w)));
    
    return originalWords.size > 0 ? intersection.size / originalWords.size : 0;
  }

  private computeTextCoherence(text: string): number {
    let coherence = 0.5;
    
    // Check for proper sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length > 0) {
      const properSentences = sentences.filter(s => /^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/.test(s.trim()));
      coherence += (properSentences.length / sentences.length) * 0.3;
    }
    
    // Check for transition words
    const transitions = ['donc', 'ainsi', 'par conséquent', 'cependant', 'néanmoins'];
    const hasTransitions = transitions.some(t => text.toLowerCase().includes(t));
    if (hasTransitions) coherence += 0.2;
    
    return Math.min(1, coherence);
  }

  private generateCacheKey(type: string, text: string, options: any = {}): string {
    const textHash = this.stableHash(text.slice(0, 200)); // First 200 chars for key
    const optionsHash = this.stableHash(JSON.stringify(options));
    return `${type}_${textHash}_${optionsHash}`;
  }

  private createEmptyResult(type: string, startTime: number): LocalModelResult {
    return {
      text: '',
      confidence: 0,
      model: `local-${type}`,
      processingTime: performance.now() - startTime,
      fallbackReason: 'empty_input'
    };
  }

  private createFallbackResult(text: string, maxLength: number, startTime: number, reason?: string): LocalModelResult {
    // Simple fallback: take first sentences up to maxLength
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    let fallback = '';
    
    for (const sentence of sentences) {
      if (fallback.length + sentence.length <= maxLength) {
        fallback += sentence.trim() + '. ';
      } else {
        break;
      }
    }
    
    if (!fallback) {
      fallback = text.slice(0, maxLength - 3) + '...';
    }
    
    return {
      text: fallback.trim(),
      confidence: 0.3,
      model: 'local-fallback',
      processingTime: performance.now() - startTime,
      fallbackReason: reason || 'fallback_strategy'
    };
  }
}

// Local answerability model
class LocalAnswerabilityModel {
  async assess(
    query: string,
    chunks: Array<{ content: string; score: number }>
  ): Promise<AnswerabilityResult> {
    if (chunks.length === 0) {
      return {
        canAnswer: false,
        confidence: 0.9,
        reasoning: 'No relevant sources found',
        evidenceScore: 0,
        coverageScore: 0
      };
    }

    const queryTerms = this.extractQueryTerms(query);
    const evidenceScore = this.computeEvidenceScore(queryTerms, chunks);
    const coverageScore = this.computeCoverageScore(queryTerms, chunks);
    const coherenceScore = this.computeChunkCoherence(chunks);
    
    const overallScore = (evidenceScore * 0.5) + (coverageScore * 0.3) + (coherenceScore * 0.2);
    const threshold = 0.6;

    return {
      canAnswer: overallScore >= threshold,
      confidence: overallScore,
      reasoning: this.generateReasoning(evidenceScore, coverageScore, coherenceScore, threshold),
      evidenceScore,
      coverageScore,
      missingConcepts: overallScore < threshold ? this.identifyMissingConcepts(queryTerms, chunks) : undefined
    };
  }

  private extractQueryTerms(query: string): string[] {
    return query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter(term => !/^(le|la|les|de|du|des|et|ou|mais|donc|car|ni|or|the|and|or|but|so|for|nor)$/i.test(term));
  }

  private computeEvidenceScore(queryTerms: string[], chunks: Array<{ content: string; score: number }>): number {
    if (queryTerms.length === 0) return 0;

    let totalEvidence = 0;
    for (const chunk of chunks) {
      const content = chunk.content.toLowerCase();
      const matches = queryTerms.filter(term => content.includes(term)).length;
      const termCoverage = matches / queryTerms.length;
      totalEvidence += termCoverage * chunk.score;
    }

    return Math.min(1, totalEvidence / chunks.length);
  }

  private computeCoverageScore(queryTerms: string[], chunks: Array<{ content: string; score: number }>): number {
    if (queryTerms.length === 0) return 0;

    const allContent = chunks.map(c => c.content.toLowerCase()).join(' ');
    const coveredTerms = queryTerms.filter(term => allContent.includes(term));
    
    return coveredTerms.length / queryTerms.length;
  }

  private computeChunkCoherence(chunks: Array<{ content: string; score: number }>): number {
    if (chunks.length <= 1) return 1;

    // Simple coherence: check for contradictory information
    let coherenceScore = 1;
    
    // Look for contradictory terms
    const contradictoryPairs = [
      ['oui', 'non'], ['yes', 'no'], ['vrai', 'faux'], ['true', 'false'],
      ['possible', 'impossible'], ['correct', 'incorrect']
    ];
    
    const allContent = chunks.map(c => c.content.toLowerCase()).join(' ');
    
    for (const [term1, term2] of contradictoryPairs) {
      if (allContent.includes(term1) && allContent.includes(term2)) {
        coherenceScore -= 0.2;
      }
    }
    
    return Math.max(0, coherenceScore);
  }

  private generateReasoning(evidence: number, coverage: number, coherence: number, threshold: number): string {
    if (evidence < 0.3) return 'Insufficient evidence in sources to answer the query';
    if (coverage < 0.4) return 'Sources do not adequately cover all aspects of the query';
    if (coherence < 0.5) return 'Sources contain contradictory or incoherent information';
    if ((evidence + coverage + coherence) / 3 < threshold) return 'Overall confidence below threshold for reliable answer';
    return 'Sources provide sufficient evidence to answer the query reliably';
  }

  private identifyMissingConcepts(queryTerms: string[], chunks: Array<{ content: string; score: number }>): string[] {
    const allContent = chunks.map(c => c.content.toLowerCase()).join(' ');
    return queryTerms.filter(term => !allContent.includes(term));
  }
}

// Supporting interfaces
interface SentenceFeatures {
  length: number;
  position: number;
  lengthRatio: number;
  hasNumbers: boolean;
  hasKeywords: number;
  complexity: number;
  coherence: number;
  informativeness: number;
}

interface LocalSummaryOptions {
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'bullet-points';
  language?: 'fr' | 'en' | 'auto';
  minQuality?: number;
}

export const enhancedLocalModels = new EnhancedLocalModels();
