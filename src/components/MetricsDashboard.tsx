// Dashboard de métriques de performance et coûts
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Zap, 
  Activity,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Cpu,
  HardDrive,
  WifiOff
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { costEnforcer } from '@/core/ai/CostEnforcer';
import { PerformanceMonitor } from '@/core/performance/PerformanceMonitor';
import { Logger } from '@/core/logging/Logger';
import { cn } from '@/lib/utils';

interface MetricsData {
  // Performance
  latencyP50: number;
  latencyP95: number;
  avgProcessingTime: number;
  
  // Coûts
  dailySpent: number;
  dailyBudget: number;
  costPerSession: number;
  
  // Cache et optimisations
  cacheHitRate: number;
  batchEfficiency: number;
  localVsExternal: number; // % local
  
  // Volume
  totalRequests: number;
  totalTokens: number;
  totalMemories: number;
  
  // Alertes
  alerts: MetricAlert[];
}

interface MetricAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  threshold?: number;
  value?: number;
}

const ALERT_THRESHOLDS = {
  latencyP95: 2000, // 2s
  dailyBudgetUsage: 0.8, // 80%
  cacheHitRate: 0.5, // 50%
  localRatio: 0.9 // 90% local souhaité
};

export const MetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Chargement des métriques
  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Toutes les 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      
      // Collecter les métriques de différentes sources
      const performanceMetrics = PerformanceMonitor.getMetrics();
      const costStats = await costEnforcer.getStats();
      
      // Données simulées pour le MVP (en prod, viendraient de l'API)
      const avgLoadTime = performanceMetrics.find(m => m.name === 'LOAD_COMPLETE')?.value || 800;
      const rawMetrics = {
        latencyP50: avgLoadTime,
        latencyP95: avgLoadTime * 2.5,
        avgProcessingTime: 1200,
        
        dailySpent: costStats.dailySpent,
        dailyBudget: 5.0,
        costPerSession: 0.02,
        
        cacheHitRate: costStats.cacheHitRate,
        batchEfficiency: costStats.batchEfficiency,
        localVsExternal: 95, // 95% local par défaut
        
        totalRequests: parseInt(localStorage.getItem('total_requests') || '0'),
        totalTokens: costStats.dailyTokens,
        totalMemories: parseInt(localStorage.getItem('total_memories') || '0'),
        
        alerts: generateAlerts(costStats, performanceMetrics)
      };
      
      setMetrics(rawMetrics);
      setLastUpdate(new Date());
      
    } catch (error) {
      Logger.error('Failed to load metrics', { error });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAlerts = (costStats: any, perfMetrics: any): MetricAlert[] => {
    const alerts: MetricAlert[] = [];
    
    // Alerte budget
    const budgetUsage = costStats.dailySpent / 5.0;
    if (budgetUsage > ALERT_THRESHOLDS.dailyBudgetUsage) {
      alerts.push({
        id: 'budget-warning',
        type: budgetUsage > 0.95 ? 'error' : 'warning',
        title: 'Budget journalier',
        message: `${Math.round(budgetUsage * 100)}% du budget utilisé`,
        timestamp: new Date(),
        threshold: ALERT_THRESHOLDS.dailyBudgetUsage,
        value: budgetUsage
      });
    }
    
    // Alerte performance
    const avgLatency = perfMetrics.find((m: any) => m.name === 'LOAD_COMPLETE')?.value || 0;
    if (avgLatency > ALERT_THRESHOLDS.latencyP95) {
      alerts.push({
        id: 'latency-warning',
        type: 'warning',
        title: 'Latence élevée',
        message: `Temps de réponse moyen: ${avgLatency}ms`,
        timestamp: new Date(),
        threshold: ALERT_THRESHOLDS.latencyP95,
        value: avgLatency
      });
    }
    
    // Alerte cache
    if (costStats.cacheHitRate < ALERT_THRESHOLDS.cacheHitRate) {
      alerts.push({
        id: 'cache-warning',
        type: 'warning',
        title: 'Taux de cache faible',
        message: `Seulement ${Math.round(costStats.cacheHitRate * 100)}% de hits`,
        timestamp: new Date(),
        threshold: ALERT_THRESHOLDS.cacheHitRate,
        value: costStats.cacheHitRate
      });
    }
    
    return alerts;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return AlertTriangle;
      case 'warning': return AlertTriangle;
      case 'info': return CheckCircle;
      default: return CheckCircle;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-destructive';
      case 'warning': return 'text-orange-500';
      case 'info': return 'text-blue-500';
      default: return 'text-green-500';
    }
  };

  // Données pour les graphiques
  const generateChartData = () => {
    const hours = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date();
      hour.setHours(hour.getHours() - (23 - i), 0, 0, 0);
      return {
        time: hour.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        latency: Math.random() * 1000 + 500,
        cost: Math.random() * 0.1,
        requests: Math.floor(Math.random() * 20) + 5
      };
    });
    return hours;
  };

  const chartData = generateChartData();

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-pulse mx-auto mb-2" />
          <p>Chargement des métriques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Métriques & Performance</h2>
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadMetrics}>
            Actualiser
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {metrics?.alerts && metrics.alerts.length > 0 && (
        <div className="space-y-2">
          {metrics.alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
                  <Icon className={cn("w-4 h-4", getAlertColor(alert.type))} />
                  <AlertDescription>
                    <strong>{alert.title}:</strong> {alert.message}
                  </AlertDescription>
                </Alert>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Latence P50</p>
                <p className="text-2xl font-bold">{metrics?.latencyP50 || 0}ms</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                P95: {metrics?.latencyP95 || 0}ms
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Coût journalier</p>
                <p className="text-2xl font-bold">${(metrics?.dailySpent || 0).toFixed(3)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Progress 
                value={((metrics?.dailySpent || 0) / (metrics?.dailyBudget || 5)) * 100} 
                className="h-2" 
              />
              <div className="text-xs text-muted-foreground mt-1">
                Budget: ${metrics?.dailyBudget || 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                <p className="text-2xl font-bold">{Math.round((metrics?.cacheHitRate || 0) * 100)}%</p>
              </div>
              <HardDrive className="w-8 h-8 text-purple-500" />
            </div>
            <div className="mt-2">
              <Badge 
                variant={metrics && metrics.cacheHitRate > 0.7 ? "default" : "destructive"}
                className="text-xs"
              >
                {metrics && metrics.cacheHitRate > 0.7 ? 'Optimal' : 'À améliorer'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Local vs Externe</p>
                <p className="text-2xl font-bold">{metrics?.localVsExternal || 0}%</p>
              </div>
              <WifiOff className="w-8 h-8 text-orange-500" />
            </div>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs text-green-600">
                Traitement local
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques détaillés */}
      <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
        <TabsList>
          <TabsTrigger value="1h">1 heure</TabsTrigger>
          <TabsTrigger value="24h">24 heures</TabsTrigger>
          <TabsTrigger value="7d">7 jours</TabsTrigger>
        </TabsList>

        <TabsContent value="24h" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique latence */}
            <Card>
              <CardHeader>
                <CardTitle>Latence (24h)</CardTitle>
                <CardDescription>Temps de réponse moyen par heure</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}ms`, 'Latence']} />
                    <Line 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Graphique coûts */}
            <Card>
              <CardHeader>
                <CardTitle>Coûts (24h)</CardTitle>
                <CardDescription>Dépenses par heure</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toFixed(3)}`, 'Coût']} />
                    <Bar dataKey="cost" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Métriques détaillées */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Temps de traitement moyen</span>
              <span className="font-medium">{metrics?.avgProcessingTime || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Requêtes totales</span>
              <span className="font-medium">{metrics?.totalRequests || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Efficacité batch</span>
              <span className="font-medium">{Math.round((metrics?.batchEfficiency || 0) * 100)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Économies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Coût par session</span>
              <span className="font-medium">${(metrics?.costPerSession || 0).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Tokens traités</span>
              <span className="font-medium">{(metrics?.totalTokens || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Économies cache</span>
              <span className="font-medium text-green-600">~$0.15</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Mémoires stockées</span>
              <span className="font-medium">{metrics?.totalMemories || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Uptime</span>
              <span className="font-medium text-green-600">99.9%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Statut système</span>
              <Badge variant="outline" className="text-green-600">
                Opérationnel
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MetricsDashboard;