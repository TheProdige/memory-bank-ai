/**
 * RAG System Dashboard - Monitoring and evaluation
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Play,
  TrendingUp,
  DollarSign,
  Clock,
  Target,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useRAGSystem } from '@/hooks/useRAGSystem';
import { Logger } from '@/core/logging/Logger';

interface RAGDashboardProps {
  className?: string;
}

export const RAGDashboard: React.FC<RAGDashboardProps> = ({ className }) => {
  const { metrics, runEvaluation, loading } = useRAGSystem({ enableEvaluation: true });
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);

  // Run evaluation
  const handleRunEvaluation = async () => {
    setEvaluationLoading(true);
    try {
      const results = await runEvaluation();
      setEvaluationResults(results);
      Logger.info('Evaluation completed', { results });
    } catch (error) {
      Logger.error('Evaluation failed', { error });
    } finally {
      setEvaluationLoading(false);
    }
  };

  // Mock data for charts
  const costData = [
    { name: 'Lun', cost: 2.4, requests: 45 },
    { name: 'Mar', cost: 1.8, requests: 32 },
    { name: 'Mer', cost: 3.2, requests: 67 },
    { name: 'Jeu', cost: 2.1, requests: 41 },
    { name: 'Ven', cost: 2.8, requests: 55 },
    { name: 'Sam', cost: 1.2, requests: 23 },
    { name: 'Dim', cost: 0.8, requests: 15 }
  ];

  const qualityData = [
    { name: 'Factuel', value: 85, color: '#10b981' },
    { name: 'Procédural', value: 78, color: '#3b82f6' },
    { name: 'Temporel', value: 92, color: '#8b5cf6' },
    { name: 'Comparatif', value: 71, color: '#f59e0b' }
  ];

  const performanceMetrics = {
    averageLatency: 245,
    successRate: 94.2,
    costEfficiency: 87.5,
    userSatisfaction: 4.3
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">RAG System Dashboard</h2>
            <p className="text-muted-foreground">
              Surveillance et évaluation du système RAG
            </p>
          </div>
          <Button 
            onClick={handleRunEvaluation}
            disabled={evaluationLoading}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            {evaluationLoading ? 'Évaluation...' : 'Lancer l\'évaluation'}
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taux de succès</p>
                  <p className="text-2xl font-bold">{performanceMetrics.successRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latence moyenne</p>
                  <p className="text-2xl font-bold">{performanceMetrics.averageLatency}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <DollarSign className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Efficacité coût</p>
                  <p className="text-2xl font-bold">{performanceMetrics.costEfficiency}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Satisfaction</p>
                  <p className="text-2xl font-bold">{performanceMetrics.userSatisfaction}/5</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="costs">Coûts</TabsTrigger>
            <TabsTrigger value="quality">Qualité</TabsTrigger>
            <TabsTrigger value="evaluation">Évaluation</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Latence par jour</CardTitle>
                  <CardDescription>Temps de réponse moyen</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={costData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Qualité par type de requête</CardTitle>
                  <CardDescription>Score de qualité moyen</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={qualityData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {qualityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Coûts par jour</CardTitle>
                  <CardDescription>Évolution des coûts API</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={costData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="cost" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Économies réalisées</CardTitle>
                  <CardDescription>Grâce aux optimisations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Cache local</span>
                      <span className="font-semibold">-45%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Déduplication</span>
                      <span className="font-semibold">-23%</span>
                    </div>
                    <Progress value={23} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Modèles locaux</span>
                      <span className="font-semibold">-67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Score F1</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0.847</div>
                  <p className="text-sm text-muted-foreground">+2.3% vs semaine dernière</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROUGE-L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0.792</div>
                  <p className="text-sm text-muted-foreground">+1.8% vs semaine dernière</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Groundedness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0.923</div>
                  <p className="text-sm text-muted-foreground">+0.5% vs semaine dernière</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="evaluation" className="space-y-4">
            {evaluationResults ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    Évaluation terminée avec succès. Score global: {Math.round(evaluationResults.overallScore * 100)}%
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Résultats par catégorie</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(evaluationResults.categoryStats || {}).map(([category, stats]: [string, any]) => (
                          <div key={category} className="flex items-center justify-between">
                            <span className="capitalize">{category}</span>
                            <Badge variant={stats.passRate > 0.8 ? "default" : "secondary"}>
                              {Math.round(stats.passRate * 100)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recommandations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {evaluationResults.recommendations?.map((rec: string, index: number) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            • {rec}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune évaluation récente</h3>
                  <p className="text-muted-foreground mb-4">
                    Lancez une évaluation pour voir les métriques de qualité
                  </p>
                  <Button onClick={handleRunEvaluation} disabled={evaluationLoading}>
                    {evaluationLoading ? 'Évaluation...' : 'Démarrer l\'évaluation'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RAGDashboard;