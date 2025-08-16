/**
 * Missing methods for RAGEvaluationSuite
 */

import { RAGResponse } from '../ai/RAGOrchestrator';

export class RAGEvaluationMethods {
  static createFailedMetrics(error: string): any {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      rouge1: 0,
      rougeL: 0,
      semantic_similarity: 0,
      groundedness: 0,
      attribution: 0,
      latency_ms: 0,
      cost_usd: 0,
      error: error
    };
  }

  static aggregateMetrics(results: any[]): any {
    if (results.length === 0) return this.createFailedMetrics('No results to aggregate');
    
    const validResults = results.filter(r => !r.error);
    if (validResults.length === 0) return this.createFailedMetrics('All results failed');
    
    const aggregate: any = {};
    const keys = Object.keys(validResults[0]).filter(k => typeof validResults[0][k] === 'number');
    
    for (const key of keys) {
      const values = validResults.map(r => r[key]).filter(v => typeof v === 'number');
      aggregate[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    aggregate.total_tests = results.length;
    aggregate.passed_tests = validResults.length;
    aggregate.success_rate = validResults.length / results.length;
    
    return aggregate;
  }

  static generateSummary(metrics: any): string {
    const summaryLines = [
      `📊 RAG Evaluation Summary`,
      `═══════════════════════`,
      `Total Tests: ${metrics.total_tests || 0}`,
      `Passed: ${metrics.passed_tests || 0}`,
      `Success Rate: ${((metrics.success_rate || 0) * 100).toFixed(1)}%`,
      ``,
      `📈 Quality Metrics:`,
      `  Accuracy: ${((metrics.accuracy || 0) * 100).toFixed(1)}%`,
      `  F1 Score: ${((metrics.f1 || 0) * 100).toFixed(1)}%`,
      `  ROUGE-L: ${((metrics.rougeL || 0) * 100).toFixed(1)}%`,
      `  Groundedness: ${((metrics.groundedness || 0) * 100).toFixed(1)}%`,
      ``,
      `⚡ Performance:`,
      `  Avg Latency: ${(metrics.latency_ms || 0).toFixed(0)}ms`,
      `  Avg Cost: $${(metrics.cost_usd || 0).toFixed(4)}`,
      ``
    ];
    
    return summaryLines.join('\n');
  }

  static computeRetrievalMetrics(expectedSources: string[], actualSources: string[]): any {
    const expectedSet = new Set(expectedSources);
    const actualSet = new Set(actualSources);
    
    const intersection = new Set([...expectedSet].filter(x => actualSet.has(x)));
    
    const precision = actualSet.size > 0 ? intersection.size / actualSet.size : 0;
    const recall = expectedSet.size > 0 ? intersection.size / expectedSet.size : 0;
    const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    return { precision, recall, f1 };
  }

  static computeOverallScore(metrics: any): number {
    const weights = {
      accuracy: 0.3,
      f1: 0.2,
      groundedness: 0.3,
      semantic_similarity: 0.2
    };
    
    let score = 0;
    let totalWeight = 0;
    
    for (const [metric, weight] of Object.entries(weights)) {
      if (metrics[metric] !== undefined) {
        score += metrics[metric] * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0 ? score / totalWeight : 0;
  }

  static evaluateTestPass(metrics: any, thresholds: any): boolean {
    const checks = [
      metrics.accuracy >= (thresholds.accuracy || 0.7),
      metrics.f1 >= (thresholds.f1 || 0.6),
      metrics.groundedness >= (thresholds.groundedness || 0.8),
      metrics.latency_ms <= (thresholds.latency_ms || 5000)
    ];
    
    return checks.every(check => check);
  }

  static computeOpenEndedQuality(response: RAGResponse, expectedTopics: string[]): any {
    const responseLower = response.answer.toLowerCase();
    const topicMatches = expectedTopics.filter(topic => 
      responseLower.includes(topic.toLowerCase())
    ).length;
    
    const coverage = expectedTopics.length > 0 ? topicMatches / expectedTopics.length : 0;
    const coherence = this.computeCoherence(response.answer);
    const citationQuality = response.citations.length > 0 ? 0.8 : 0.3;
    
    return {
      topic_coverage: coverage,
      coherence,
      citation_quality: citationQuality,
      overall_quality: (coverage + coherence + citationQuality) / 3
    };
  }

  static computeCoherence(text: string): number {
    // Simple coherence score based on text structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    const hasConnectors = /\b(donc|ainsi|cependant|néanmoins|par conséquent|en effet)\b/i.test(text);
    
    let score = 0.5;
    if (avgSentenceLength > 5 && avgSentenceLength < 25) score += 0.3;
    if (hasConnectors) score += 0.2;
    
    return Math.min(1, score);
  }

  static computeROUGE1(reference: string, candidate: string): number {
    const refWords = new Set(reference.toLowerCase().split(/\s+/));
    const candWords = candidate.toLowerCase().split(/\s+/);
    
    const matches = candWords.filter(word => refWords.has(word)).length;
    return candWords.length > 0 ? matches / candWords.length : 0;
  }

  static computeROUGEL(reference: string, candidate: string): number {
    // Simplified ROUGE-L implementation
    const refWords = reference.toLowerCase().split(/\s+/);
    const candWords = candidate.toLowerCase().split(/\s+/);
    
    // Find longest common subsequence
    const lcs = this.longestCommonSubsequence(refWords, candWords);
    const recall = refWords.length > 0 ? lcs / refWords.length : 0;
    const precision = candWords.length > 0 ? lcs / candWords.length : 0;
    
    return (recall + precision) > 0 ? 2 * recall * precision / (recall + precision) : 0;
  }

  static longestCommonSubsequence(seq1: string[], seq2: string[]): number {
    const m = seq1.length;
    const n = seq2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (seq1[i - 1] === seq2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    return dp[m][n];
  }

  static computeSemanticSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  static computeSupportScore(response: RAGResponse, sources: any[]): number {
    if (sources.length === 0) return 0;
    
    const sourcedClaims = response.citations.length;
    const totalClaims = response.answer.split(/[.!?]+/).length;
    
    return totalClaims > 0 ? Math.min(1, sourcedClaims / totalClaims) : 0;
  }

  static computeAttributionScore(response: RAGResponse, sources: any[]): number {
    if (response.citations.length === 0) return 0;
    
    const validCitations = response.citations.filter(citation => {
      return sources.some(source => 
        source.id === citation.sourceId && 
        source.content.toLowerCase().includes(citation.text.toLowerCase().slice(0, 50))
      );
    });
    
    return response.citations.length > 0 ? validCitations.length / response.citations.length : 0;
  }
}