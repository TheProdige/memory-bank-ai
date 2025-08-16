/**
 * Production RAG Evaluation Suite - Comprehensive testing and metrics
 */

import { ragOrchestrator, RAGResponse } from '@/core/ai/RAGOrchestrator';
import { Logger } from '@/core/logging/Logger';
import { RAGEvaluationMethods } from './RAGEvaluationMethods';

export interface EvaluationResult {
  overallScore: number;
  metrics: EvaluationMetrics;
  summary: EvaluationSummary;
  testResults: TestCaseResult[];
  timestamp: Date;
  version: string;
}

export interface EvaluationMetrics {
  quality: QualityMetrics;
  retrieval: RetrievalMetrics;
  performance: PerformanceMetrics;
  cost: CostMetrics;
  groundedness: GroundednessMetrics;
}

export interface QualityMetrics {
  exactMatch: number;
  f1Score: number;
  rouge1: number;
  rougeL: number;
  bleuScore: number;
  semanticSimilarity: number;
}

export interface RetrievalMetrics {
  precision: number;
  recall: number;
  f1: number;
  mrr: number;
  ndcg: number;
}

export interface GroundednessMetrics {
  supportScore: number;
  attributionScore: number;
  hallucinationScore: number;
  citationAccuracy: number;
}

export interface TestCase {
  id: string;
  query: string;
  expectedAnswer?: string;
  expectedSources?: string[];
  category: TestCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  shouldHallucinate: boolean;
  context?: any;
}

type TestCategory = 'factual' | 'procedural' | 'comparative' | 'temporal' | 'trap' | 'complex';

export class RAGEvaluationSuite {
  private testCases: TestCase[] = [];
  
  constructor() {
    this.generateTestCases();
  }

  async runFullEvaluation(userId: string): Promise<EvaluationResult> {
    const startTime = performance.now();
    
    Logger.info('Starting RAG evaluation', { testCaseCount: this.testCases.length });

    try {
      const results = await this.runTestCases(userId);
      return this.createEvaluationResult(results);
      
    } catch (error) {
      Logger.error('Evaluation suite failed', { error });
      return RAGEvaluationMethods.createFailedMetrics();
    }
  }

  private async runTestCases(userId: string): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];
    
    for (const testCase of this.testCases) {
      const result = await this.runTestCase(testCase, userId);
      results.push(result);
    }
    
    return results;
  }

  private createEvaluationResult(results: TestCaseResult[]): EvaluationResult {
    const metrics = RAGEvaluationMethods.aggregateMetrics(results);
    const summary = RAGEvaluationMethods.generateSummary(metrics, results);
    
    return {
      overallScore: metrics.quality.overall || 0,
      metrics,
      summary,
      testResults: results,
      timestamp: new Date(),
      version: '1.0.0'
    };
  }

  private async runTestCase(testCase: TestCase, userId: string): Promise<TestCaseResult> {
    const startTime = performance.now();
    
    try {
      const response = await ragOrchestrator.processQuery({
        query: testCase.query,
        userId,
        context: testCase.context
      });

      const latency = performance.now() - startTime;
      
      const qualityMetrics = await RAGEvaluationMethods.computeQualityMetrics(testCase, response);
      const retrievalMetrics = RAGEvaluationMethods.computeRetrievalMetrics(response);
      const performanceMetrics = { latency: latency, throughput: 1000 / latency };
      const costMetrics = { total: response.metadata?.cost || 0, perQuery: response.metadata?.cost || 0 };
      const overallScore = RAGEvaluationMethods.computeOverallScore(qualityMetrics);
      const passed = RAGEvaluationMethods.evaluateTestPass(testCase, response, overallScore);

      return {
        testCase,
        response,
        metrics: {
          quality: qualityMetrics,
          retrieval: retrievalMetrics,
          performance: performanceMetrics,
          cost: costMetrics,
          groundedness: await RAGEvaluationMethods.computeGroundednessMetrics(testCase, response)
        },
        passed,
        overallScore
      };

    } catch (error) {
      Logger.error('Test case execution failed', { testCaseId: testCase.id, error });
      return {
        testCase,
        response: null,
        metrics: RAGEvaluationMethods.createFailedTestMetrics(),
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Evaluation methods moved to RAGEvaluationMethods class

  // Additional utility methods moved to RAGEvaluationMethods

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
        shouldHallucinate: true
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
  throughput: number;
}

interface CostMetrics {
  total: number;
  perQuery: number;
}

export const ragEvaluationSuite = new RAGEvaluationSuite();