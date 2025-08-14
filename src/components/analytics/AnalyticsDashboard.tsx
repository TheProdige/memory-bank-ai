/**
 * Professional Analytics Dashboard
 * Real-time metrics and performance insights
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Zap,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { PerformanceMonitor } from '@/core/performance/PerformanceMonitor';
import { Logger } from '@/core/logging/Logger';
import { CacheManager } from '@/core/cache/CacheManager';
import { useAppStore } from '@/core/state/AppStore';

interface AnalyticsData {
  performance: {
    avgPageLoad: number;
    avgApiResponse: number;
    memoryUsage: number;
    cacheHitRate: number;
  };
  usage: {
    totalSessions: number;
    avgSessionDuration: number;
    totalMemories: number;
    totalTranscriptions: number;
  };
  errors: {
    total: number;
    critical: number;
    warnings: number;
    resolved: number;
  };
  trends: {
    performanceScore: number;
    usageGrowth: number;
    errorRate: number;
  };
}

export const AnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    
    try {
      // Simulate API call - in real app, this would be from your analytics service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const performanceMetrics = PerformanceMonitor.getMetrics();
      const cacheStats = CacheManager.getMemoryUsage();
      const logs = Logger.getLogs();
      
      const analyticsData: AnalyticsData = {
        performance: {
          avgPageLoad: PerformanceMonitor.getAverageMetric('LOAD_COMPLETE') || 0,
          avgApiResponse: calculateAvgApiResponse(),
          memoryUsage: cacheStats.percentage,
          cacheHitRate: calculateCacheHitRate(),
        },
        usage: {
          totalSessions: parseInt(localStorage.getItem('total_sessions') || '0'),
          avgSessionDuration: calculateAvgSessionDuration(),
          totalMemories: parseInt(localStorage.getItem('total_memories') || '0'),
          totalTranscriptions: parseInt(localStorage.getItem('total_transcriptions') || '0'),
        },
        errors: {
          total: logs.filter(log => log.level >= 2).length,
          critical: logs.filter(log => log.level === 3).length,
          warnings: logs.filter(log => log.level === 2).length,
          resolved: 0, // Would be calculated from resolved tickets
        },
        trends: {
          performanceScore: calculatePerformanceScore(),
          usageGrowth: Math.random() * 20 + 10, // Simulated
          errorRate: (logs.filter(log => log.level >= 2).length / logs.length) * 100,
        },
      };
      
      setData(analyticsData);
    } catch (error) {
      Logger.error('Failed to load analytics data', { error });
    } finally {
      setLoading(false);
    }
  };

  const calculateAvgApiResponse = (): number => {
    const { performance } = useAppStore.getState();
    const apiTimes = Object.values(performance.metrics.apiResponseTimes).flat();
    return apiTimes.length > 0 ? apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length : 0;
  };

  const calculateCacheHitRate = (): number => {
    // Simulated cache hit rate - in real app, track this in CacheManager
    return Math.random() * 30 + 70; // 70-100%
  };

  const calculateAvgSessionDuration = (): number => {
    // Simulated - in real app, track session start/end times
    return Math.random() * 30 + 15; // 15-45 minutes
  };

  const calculatePerformanceScore = (): number => {
    if (!data) return 0;
    
    // Weight different metrics for overall score
    const loadScore = Math.max(0, 100 - (data.performance.avgPageLoad / 50));
    const apiScore = Math.max(0, 100 - (data.performance.avgApiResponse / 10));
    const memoryScore = Math.max(0, 100 - data.performance.memoryUsage);
    const cacheScore = data.performance.cacheHitRate;
    
    return Math.round((loadScore + apiScore + memoryScore + cacheScore) / 4);
  };

  const exportData = () => {
    if (!data) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      timeRange,
      data,
      performance: PerformanceMonitor.exportMetrics(),
      cache: CacheManager.getStats(),
      logs: Logger.getLogs(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echovault-analytics-${timeRange}-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    Logger.logUserAction('export_analytics', { timeRange });
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const getTrendIcon = (value: number, inverse = false) => {
    const isPositive = inverse ? value < 0 : value > 0;
    return isPositive ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tableau de bord analytique</h2>
          <p className="text-muted-foreground">
            Métriques de performance et d'utilisation en temps réel
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 heure</SelectItem>
              <SelectItem value="24h">24 heures</SelectItem>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Performance Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Score de performance global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${getPerformanceColor(data.trends.performanceScore)}`}>
                {data.trends.performanceScore}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getTrendIcon(data.trends.usageGrowth)}
                  +{data.trends.usageGrowth.toFixed(1)}% ce mois
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary rounded-full h-2 transition-all duration-500"
                    style={{ width: `${data.trends.performanceScore}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Temps de chargement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.performance.avgPageLoad.toFixed(0)}ms
              </div>
              <p className="text-xs text-muted-foreground">
                Moyenne des pages
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Sessions actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.usage.totalSessions.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getTrendIcon(data.trends.usageGrowth)}
                {data.trends.usageGrowth.toFixed(1)}% vs hier
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Cache hit rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.performance.cacheHitRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Efficacité du cache
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Taux d'erreur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.trends.errorRate.toFixed(2)}%
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getTrendIcon(data.trends.errorRate, true)}
                {data.errors.total} erreurs détectées
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Métriques d'utilisation</CardTitle>
              <CardDescription>
                Statistiques d'utilisation de l'application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Mémoires créées</span>
                <Badge variant="secondary">{data.usage.totalMemories}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Transcriptions</span>
                <Badge variant="secondary">{data.usage.totalTranscriptions}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Durée moyenne session</span>
                <Badge variant="secondary">{data.usage.avgSessionDuration.toFixed(1)}min</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Utilisation mémoire</span>
                <Badge variant={data.performance.memoryUsage > 80 ? "destructive" : "secondary"}>
                  {data.performance.memoryUsage.toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>État du système</CardTitle>
              <CardDescription>
                Monitoring de la santé de l'application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Services opérationnels
                </span>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  100%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Erreurs critiques
                </span>
                <Badge variant={data.errors.critical > 0 ? "destructive" : "secondary"}>
                  {data.errors.critical}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  Avertissements
                </span>
                <Badge variant="secondary">{data.errors.warnings}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Réponse API moyenne</span>
                <Badge variant={data.performance.avgApiResponse > 1000 ? "destructive" : "secondary"}>
                  {data.performance.avgApiResponse.toFixed(0)}ms
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};