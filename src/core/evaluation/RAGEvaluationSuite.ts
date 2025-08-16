/**
 * Production RAG Evaluation Suite - Comprehensive testing and metrics
 */

import { Logger } from '@/core/logging/Logger';
import { ragOrchestrator } from '@/core/ai/RAGOrchestrator';

export interface EvaluationResult {
  testId: string;
  timestamp: Date;
  metrics: EvaluationMetrics;
  testCases: TestCaseResult[];
  summary: EvaluationSummary;
}

export interface EvaluationMetrics {
  quality: QualityMetrics;
  retrieval: RetrievalMetrics;
  performance: PerformanceMetrics;
  cost: CostMetrics;
  groundedness: GroundednessMetrics;
}

export interface QualityMetrics {
  exactMatch: number;        // 0-1
  f1Score: number;          // 0-1
  bleuScore: number;        // 0-1
  rouge1: number;           // 0-1
  rouge2: number;           // 0-1
  rougeL: number;           // 0-1
  semanticSimilarity: number; // 0-1
}

export interface RetrievalMetrics {
  recallAt5: number;        // 0-1
  recallAt10: number;       // 0-1
  precisionAt5: number;     // 0-1
  meanReciprocalRank: number; // 0-1
  ndcg: number;             // 0-1
}

export interface GroundednessMetrics {
  citationAccuracy: number;  // 0-1
  hallucinationRate: number; // 0-1
  supportScore: number;      // 0-1
  attributionScore: number;  // 0-1
}

export interface TestCase {
  id: string;
  query: string;
  expectedAnswer?: string;
  expectedSources?: string[];
  category: TestCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  shouldHallucinate: boolean; // True for tests expecting "I don't know"
  context?: any;
}

type TestCategory = 'factual' | 'procedural' | 'comparative' | 'temporal' | 'trap' | 'complex';

export class RAGEvaluationSuite {
  private testCases: TestCase[] = [];
  
  constructor() {
    this.generateTestCases();
  }

  async runFullEvaluation(userId: string): Promise<EvaluationResult> {
    const testId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = performance.now();
    
    Logger.info('Starting RAG evaluation', { testId, testCaseCount: this.testCases.length });

    const results: TestCaseResult[] = [];
    
    for (const testCase of this.testCases) {
      try {
        const result = await this.runTestCase(testCase, userId);
        results.push(result);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        Logger.error('Test case failed', { testCaseId: testCase.id, error });
        results.push({
          testCase,
          response: null,
          metrics: this.createFailedMetrics(),
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const aggregatedMetrics = this.aggregateMetrics(results);
    const summary = this.generateSummary(results, aggregatedMetrics);
    
    const totalTime = performance.now() - startTime;
    
    Logger.info('RAG evaluation completed', {
      testId,
      totalTime,
      passRate: summary.passRate,
      avgQuality: aggregatedMetrics.quality.f1Score
    });

    return {
      testId,
      timestamp: new Date(),
      metrics: aggregatedMetrics,
      testCases: results,
      summary
    };
  }

  private async runTestCase(testCase: TestCase, userId: string): Promise<TestCaseResult> {
    const startTime = performance.now();
    
    const response = await ragOrchestrator.processQuery({
      query: testCase.query,
      userId,
      context: testCase.context
    });

    const processingTime = performance.now() - startTime;

    // Compute test-specific metrics
    const qualityMetrics = this.computeQualityMetrics(testCase, response);
    const retrievalMetrics = this.computeRetrievalMetrics(testCase, response);
    const groundednessMetrics = this.computeGroundednessMetrics(testCase, response);
    
    const overallScore = this.computeOverallScore(qualityMetrics, retrievalMetrics, groundednessMetrics);
    const passed = this.evaluateTestPass(testCase, response, overallScore);

    return {
      testCase,
      response,
      metrics: {
        quality: qualityMetrics,
        retrieval: retrievalMetrics,
        performance: {
          latency: processingTime,
          tokensUsed: response.metadata.tokensUsed,
          cost: response.metadata.cost
        },
        cost: {
          totalCost: response.metadata.cost,
          costPerToken: response.metadata.cost / Math.max(1, response.metadata.tokensUsed),
          efficiency: overallScore / Math.max(0.001, response.metadata.cost)
        },
        groundedness: groundednessMetrics
      },
      passed,
      overallScore
    };
  }

  private computeQualityMetrics(testCase: TestCase, response: RAGResponse): QualityMetrics {
    if (!testCase.expectedAnswer) {
      // For trap questions or open-ended queries, use different metrics
      return this.computeOpenEndedQuality(testCase, response);
    }

    const predicted = response.answer.toLowerCase().trim();
    const reference = testCase.expectedAnswer.toLowerCase().trim();

    return {
      exactMatch: predicted === reference ? 1 : 0,
      f1Score: this.computeF1Score(predicted, reference),
      bleuScore: this.computeBLEUScore(predicted, reference),
      rouge1: this.computeROUGE1(predicted, reference),
      rouge2: this.computeROUGE2(predicted, reference),
      rougeL: this.computeROUGEL(predicted, reference),
      semanticSimilarity: this.computeSemanticSimilarity(predicted, reference)
    };
  }

  private computeGroundednessMetrics(testCase: TestCase, response: RAGResponse): GroundednessMetrics {
    const citationAccuracy = this.evaluateCitationAccuracy(response);
    const hallucinationRate = this.detectHallucinations(response);
    const supportScore = this.computeSupportScore(response);
    const attributionScore = this.computeAttributionScore(response);

    return {
      citationAccuracy,
      hallucinationRate,
      supportScore,
      attributionScore
    };
  }

  private evaluateCitationAccuracy(response: RAGResponse): number {
    if (response.citations.length === 0) return 0;

    let accurateCount = 0;
    for (const citation of response.citations) {
      // Find corresponding source
      const source = response.sources.find(s => s.id === citation.sourceId);
      if (!source) continue;

      // Check if citation text actually appears in source
      const citationInSource = source.content.toLowerCase().includes(
        citation.text.toLowerCase().trim()
      );

      if (citationInSource) accurateCount++;
    }

    return accurateCount / response.citations.length;
  }

  private detectHallucinations(response: RAGResponse): number {
    // Simple hallucination detection based on unsupported claims
    const answer = response.answer.toLowerCase();
    const allSourceContent = response.sources
      .map(s => s.content.toLowerCase())
      .join(' ');

    // Extract claims (sentences with factual statements)
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 10);
    let unsupportedCount = 0;

    for (const sentence of sentences) {
      const isSupported = this.isSentenceSupported(sentence.trim(), allSourceContent);
      if (!isSupported) unsupportedCount++;
    }

    return sentences.length > 0 ? unsupportedCount / sentences.length : 0;
  }

  private isSentenceSupported(sentence: string, sourceContent: string): boolean {
    // Extract key terms from sentence
    const terms = sentence.split(/\s+/)
      .filter(term => term.length > 3)
      .filter(term => !/^(le|la|les|de|du|des|et|ou|mais|donc|car|ni|or)$/i.test(term));

    if (terms.length === 0) return true; // Empty sentence considered neutral

    // Check if sufficient terms are present in sources
    const supportedTerms = terms.filter(term => 
      sourceContent.includes(term.toLowerCase())
    );

    return supportedTerms.length / terms.length >= 0.6; // 60% term coverage required
  }

  private computeF1Score(predicted: string, reference: string): number {
    const predTokens = new Set(predicted.split(/\s+/));
    const refTokens = new Set(reference.split(/\s+/));
    
    const intersection = new Set([...predTokens].filter(token => refTokens.has(token)));
    
    const precision = intersection.size / predTokens.size;
    const recall = intersection.size / refTokens.size;
    
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  private computeBLEUScore(predicted: string, reference: string): number {
    // Simplified BLEU-1 score
    const predTokens = predicted.split(/\s+/);
    const refTokens = reference.split(/\s+/);
    
    let matches = 0;
    const refCounts = new Map<string, number>();
    
    // Count reference tokens
    for (const token of refTokens) {
      refCounts.set(token, (refCounts.get(token) || 0) + 1);
    }
    
    // Count matches
    for (const token of predTokens) {
      const count = refCounts.get(token);
      if (count && count > 0) {
        matches++;
        refCounts.set(token, count - 1);
      }
    }
    
    return predTokens.length > 0 ? matches / predTokens.length : 0;
  }

  private computeROUGE1(predicted: string, reference: string): number {
    const predWords = new Set(predicted.split(/\s+/));
    const refWords = new Set(reference.split(/\s+/));
    
    const intersection = new Set([...refWords].filter(word => predWords.has(word)));
    
    return refWords.size > 0 ? intersection.size / refWords.size : 0;
  }

  private computeROUGE2(predicted: string, reference: string): number {
    const predBigrams = this.getBigrams(predicted);
    const refBigrams = this.getBigrams(reference);
    
    const intersection = predBigrams.filter(bigram => refBigrams.includes(bigram));
    
    return refBigrams.length > 0 ? intersection.length / refBigrams.length : 0;
  }

  private getBigrams(text: string): string[] {
    const words = text.split(/\s+/);
    const bigrams: string[] = [];
    
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    
    return bigrams;
  }

  private generateTestCases(): void {
    this.testCases = [
      // Factual queries
      {
        id: 'fact_001',
        query: 'Quelle est la capitale de la France?',
        expectedAnswer: 'Paris',
        category: 'factual',
        difficulty: 'easy',
        shouldHallucinate: false
      },
      {
        id: 'fact_002',
        query: 'Combien y a-t-il de jours dans une année bissextile?',
        expectedAnswer: '366 jours',
        category: 'factual',
        difficulty: 'easy',
        shouldHallucinate: false
      },

      // Procedural queries
      {
        id: 'proc_001',
        query: 'Comment faire cuire un œuf à la coque?',
        category: 'procedural',
        difficulty: 'medium',
        shouldHallucinate: false
      },

      // Trap questions (should return "I don't know")
      {
        id: 'trap_001',
        query: 'Quel est le nom du chien de mon voisin?',
        category: 'trap',
        difficulty: 'easy',
        shouldHallucinate: true // Should say "I don't know"
      },
      {
        id: 'trap_002',
        query: 'Quelle sera la météo demain à Tokyo?',
        category: 'trap',
        difficulty: 'medium',
        shouldHallucinate: true
      },

      // Complex reasoning
      {
        id: 'complex_001',
        query: 'Compare les avantages et inconvénients de l\'énergie solaire versus l\'énergie nucléaire',
        category: 'complex',
        difficulty: 'hard',
        shouldHallucinate: false
      },

      // Temporal queries
      {
        id: 'temp_001',
        query: 'Que s\'est-il passé en 1969 dans l\'exploration spatiale?',
        category: 'temporal',
        difficulty: 'medium',
        shouldHallucinate: false
      },

      // Multi-hop reasoning
      {
        id: 'multi_001',
        query: 'Si je veux visiter la capitale du pays où se trouve le Mont Fuji, où dois-je aller?',
        expectedAnswer: 'Tokyo',
        category: 'complex',
        difficulty: 'hard',
        shouldHallucinate: false
      }
    ];
  }
}

// Supporting interfaces
interface TestCaseResult {
  testCase: TestCase;
  response: RAGResponse | null;
  metrics: EvaluationMetrics;
  passed: boolean;
  overallScore?: number;
  error?: string;
}

interface EvaluationSummary {
  totalTests: number;
  passedTests: number;
  passRate: number;
  averageScore: number;
  categoryBreakdown: Record<TestCategory, CategoryStats>;
  recommendations: string[];
}

interface CategoryStats {
  total: number;
  passed: number;
  averageScore: number;
}

interface PerformanceMetrics {
  latency: number;
  tokensUsed: number;
  cost: number;
}

interface CostMetrics {
  totalCost: number;
  costPerToken: number;
  efficiency: number; // Score per dollar
}

export const ragEvaluationSuite = new RAGEvaluationSuite();