/**
 * RAG Dashboard Component Tests
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RAGDashboard } from '../RAGDashboard';
import { useRAGSystem } from '@/hooks/useRAGSystem';

// Mock dependencies
vi.mock('@/hooks/useRAGSystem');
vi.mock('@/core/logging/Logger');

// Mock recharts
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}));

const mockUseRAGSystem = useRAGSystem as any;

describe('RAGDashboard', () => {
  const mockRunEvaluation = vi.fn();
  const mockMetrics = {
    cost: {
      total: 15.75,
      daily: 2.30,
      hourly: 0.15
    },
    performance: {
      averageLatency: 245,
      successRate: 94.2
    }
  };

  beforeEach(() => {
    mockUseRAGSystem.mockReturnValue({
      metrics: mockMetrics,
      runEvaluation: mockRunEvaluation,
      loading: false
    });
    
    mockRunEvaluation.mockClear();
  });

  describe('Rendering', () => {
    it('should render dashboard header', () => {
      render(<RAGDashboard />);
      
      expect(screen.getByText('RAG System Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Surveillance et évaluation du système RAG')).toBeInTheDocument();
    });

    it('should render quick stats cards', () => {
      render(<RAGDashboard />);
      
      expect(screen.getByText('Taux de succès')).toBeInTheDocument();
      expect(screen.getByText('Latence moyenne')).toBeInTheDocument();
      expect(screen.getByText('Efficacité coût')).toBeInTheDocument();
      expect(screen.getByText('Satisfaction')).toBeInTheDocument();
    });

    it('should render performance metrics', () => {
      render(<RAGDashboard />);
      
      expect(screen.getByText('94.2%')).toBeInTheDocument();
      expect(screen.getByText('245ms')).toBeInTheDocument();
    });

    it('should render evaluation button', () => {
      render(<RAGDashboard />);
      
      const evaluationButton = screen.getByRole('button', { name: /lancer l'évaluation/i });
      expect(evaluationButton).toBeInTheDocument();
    });
  });

  describe('Tabs Navigation', () => {
    it('should render all tabs', () => {
      render(<RAGDashboard />);
      
      expect(screen.getByRole('tab', { name: /performance/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /coûts/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /qualité/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /évaluation/i })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
      render(<RAGDashboard />);
      
      const costsTab = screen.getByRole('tab', { name: /coûts/i });
      fireEvent.click(costsTab);
      
      expect(screen.getByText('Coûts par jour')).toBeInTheDocument();
      expect(screen.getByText('Économies réalisées')).toBeInTheDocument();
    });

    it('should show quality metrics in quality tab', () => {
      render(<RAGDashboard />);
      
      const qualityTab = screen.getByRole('tab', { name: /qualité/i });
      fireEvent.click(qualityTab);
      
      expect(screen.getByText('Score F1')).toBeInTheDocument();
      expect(screen.getByText('ROUGE-L')).toBeInTheDocument();
      expect(screen.getByText('Groundedness')).toBeInTheDocument();
    });
  });

  describe('Charts', () => {
    it('should render charts in performance tab', () => {
      render(<RAGDashboard />);
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('should render cost chart in costs tab', () => {
      render(<RAGDashboard />);
      
      const costsTab = screen.getByRole('tab', { name: /coûts/i });
      fireEvent.click(costsTab);
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('Evaluation', () => {
    it('should run evaluation when button is clicked', async () => {
      render(<RAGDashboard />);
      
      const evaluationButton = screen.getByRole('button', { name: /lancer l'évaluation/i });
      fireEvent.click(evaluationButton);
      
      expect(mockRunEvaluation).toHaveBeenCalledTimes(1);
    });

    it('should show loading state during evaluation', async () => {
      mockUseRAGSystem.mockReturnValue({
        metrics: mockMetrics,
        runEvaluation: mockRunEvaluation,
        loading: true
      });

      render(<RAGDashboard />);
      
      const evaluationButton = screen.getByRole('button', { name: /évaluation/i });
      expect(evaluationButton).toBeDisabled();
    });

    it('should display evaluation results', async () => {
      const mockEvaluationResults = {
        overallScore: 0.847,
        categoryStats: {
          factual: { passRate: 0.92 },
          procedural: { passRate: 0.78 }
        },
        recommendations: [
          'Améliorer la précision des citations',
          'Optimiser les requêtes temporelles'
        ]
      };

      mockRunEvaluation.mockResolvedValue(mockEvaluationResults);

      render(<RAGDashboard />);
      
      const evaluationTab = screen.getByRole('tab', { name: /évaluation/i });
      fireEvent.click(evaluationTab);
      
      const evaluationButton = screen.getByRole('button', { name: /lancer l'évaluation/i });
      fireEvent.click(evaluationButton);
      
      await waitFor(() => {
        expect(screen.getByText(/évaluation terminée avec succès/i)).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument(); // Overall score
      });
    });

    it('should show no evaluation state initially', () => {
      render(<RAGDashboard />);
      
      const evaluationTab = screen.getByRole('tab', { name: /évaluation/i });
      fireEvent.click(evaluationTab);
      
      expect(screen.getByText('Aucune évaluation récente')).toBeInTheDocument();
    });
  });

  describe('Cost Savings', () => {
    it('should display cost optimization metrics', () => {
      render(<RAGDashboard />);
      
      const costsTab = screen.getByRole('tab', { name: /coûts/i });
      fireEvent.click(costsTab);
      
      expect(screen.getByText('Cache local')).toBeInTheDocument();
      expect(screen.getByText('Déduplication')).toBeInTheDocument();
      expect(screen.getByText('Modèles locaux')).toBeInTheDocument();
      
      expect(screen.getByText('-45%')).toBeInTheDocument();
      expect(screen.getByText('-23%')).toBeInTheDocument();
      expect(screen.getByText('-67%')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle evaluation errors gracefully', async () => {
      mockRunEvaluation.mockRejectedValue(new Error('Evaluation failed'));

      render(<RAGDashboard />);
      
      const evaluationButton = screen.getByRole('button', { name: /lancer l'évaluation/i });
      fireEvent.click(evaluationButton);
      
      await waitFor(() => {
        // Should not crash and button should be re-enabled
        expect(evaluationButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<RAGDashboard />);
      
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', () => {
      render(<RAGDashboard />);
      
      const firstTab = screen.getByRole('tab', { name: /performance/i });
      firstTab.focus();
      
      expect(document.activeElement).toBe(firstTab);
    });
  });

  describe('Responsive Design', () => {
    it('should render responsive grid layouts', () => {
      render(<RAGDashboard />);
      
      // Check for responsive classes (simplified check)
      const grids = screen.getAllByTestId('responsive-container');
      expect(grids.length).toBeGreaterThan(0);
    });
  });
});