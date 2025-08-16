/**
 * Simple RAG Types - Essential interfaces for the enhanced system
 */

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface QueryFilters {
  dateRange?: { start: Date; end: Date };
  categories?: string[];
  sources?: string[];
  minScore?: number;
}

export interface UserPreferences {
  language: 'fr' | 'en';
  responseStyle: 'concise' | 'detailed';
  citationStyle: 'inline' | 'footer';
}

export interface RAGOptions {
  maxResults?: number;
  threshold?: number;
  enableReranking?: boolean;
  useLocalOnly?: boolean;
}

export interface IntentAnalysis {
  type: 'factual' | 'procedural' | 'temporal' | 'comparative';
  complexity: number;
  scope: string[];
  entities: string[];
  expectedAnswerType: 'short' | 'explanation' | 'list';
  temporal?: {
    start: Date;
    end: Date;
  };
}

export interface RerankedChunk {
  id: string;
  content: string;
  originalScore: number;
  score: number;
  source: string;
  metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
  title?: string;
  author?: string;
  date?: string;
  type?: string;
}

export interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
}

export interface RAGMetadata {
  requestId: string;
  processingTime: number;
  model: string;
  tokensUsed: number;
  cost: number;
  retrievalStats: {
    totalCandidates: number;
    afterRerank: number;
    strategy: string;
  };
}

export interface CostDecision {
  allowed: boolean;
  reason: string;
  suggestedAction: string;
  estimatedCost: number;
}

export interface Alternative {
  description: string;
  cost: number;
  quality: number;
}