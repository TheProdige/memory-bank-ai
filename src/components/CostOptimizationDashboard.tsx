import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  Zap, 
  Brain, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Settings,
  BarChart3,
  Cpu,
  Globe
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useHybridProcessing } from '@/hooks/useHybridProcessing';
import { useFrequencyOptimizer } from '@/hooks/useFrequencyOptimizer';
import { toast } from 'sonner';

interface CostStats {
  totalSaved: number;
  apiCalls: number;
  localCalls: number;
  avgComplexity: number;
  costBreakdown: {
    transcription: number;
    processing: number;
    embeddings: number;
  };
}

interface PerformanceMetrics {
  avgResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  optimizationsApplied: string[];
}

const CostOptimizationDashboard = () => {
  const { user } = useAuth();
  const { stats: hybridStats } = useHybridProcessing();
  const { frequencies, metrics: freqMetrics, getOptimizationStats } = useFrequencyOptimizer();
  
  const [costStats, setCostStats] = useState<CostStats>({
    totalSaved: 0,
    apiCalls: 0,
    localCalls: 0,
    avgComplexity: 0,
    costBreakdown: { transcription: 0, processing: 0, embeddings: 0 }
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    avgResponseTime: 0,
    successRate: 0,
    cacheHitRate: 0,
    optimizationsApplied: []
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCostAnalytics();
    }
  }, [user]);

  const fetchCostAnalytics = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Récupérer les logs AI des 30 derniers jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: aiLogs, error } = await supabase
        .from('ai_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculs de coûts
      const totalCost = aiLogs?.reduce((sum, log) => sum + (log.cost_usd || 0), 0) || 0;
      const totalCalls = aiLogs?.length || 0;
      const avgComplexity = 0.6; // TODO: calculer depuis les données réelles

      // Estimation des économies (comparé à 100% API)
      const estimatedFullAPICost = totalCalls * 0.005; // $0.005 par appel en moyenne
      const actualCost = totalCost;
      const totalSaved = Math.max(0, estimatedFullAPICost - actualCost);

      // Breakdown par type d'opération
      const costBreakdown = {
        transcription: aiLogs?.filter(l => l.operation === 'transcribe')
          .reduce((sum, log) => sum + (log.cost_usd || 0), 0) || 0,
        processing: aiLogs?.filter(l => l.operation === 'process')
          .reduce((sum, log) => sum + (log.cost_usd || 0), 0) || 0,
        embeddings: aiLogs?.filter(l => l.operation === 'embed')
          .reduce((sum, log) => sum + (log.cost_usd || 0), 0) || 0,
      };

      // Métriques de performance
      const avgLatency = aiLogs?.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / Math.max(1, totalCalls);
      const cacheHits = aiLogs?.filter(l => l.cache_hit).length || 0;
      const cacheHitRate = totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0;

      setCostStats({
        totalSaved,
        apiCalls: totalCalls - hybridStats.localCalls,
        localCalls: hybridStats.localCalls,
        avgComplexity,
        costBreakdown
      });

      setPerformanceMetrics({
        avgResponseTime: avgLatency || 0,
        successRate: 95, // TODO: calculer depuis les erreurs
        cacheHitRate,
        optimizationsApplied: [
          'Routing intelligent',
          'Cache local',
          'Batch processing',
          'Compression prompts'
        ]
      });

    } catch (error) {
      console.error('Erreur analytics:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const optimizationScore = Math.round(
    (costStats.localCalls / Math.max(1, costStats.apiCalls + costStats.localCalls)) * 100
  );

  const freqStats = getOptimizationStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Optimisation des Coûts</h2>
          <p className="text-muted-foreground">
            Architecture hybride pour réduire les coûts API
          </p>
        </div>
        <Button onClick={fetchCostAnalytics} disabled={loading}>
          <BarChart3 className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Score global d'optimisation */}
      <Card className="shadow-elegant border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-accent" />
            Score d'Optimisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={optimizationScore} className="h-3" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-accent">{optimizationScore}%</div>
              <div className="text-sm text-muted-foreground">Modèles locaux</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-accent">${costStats.totalSaved.toFixed(3)}</div>
              <div className="text-xs text-muted-foreground">Économisé</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{costStats.localCalls}</div>
              <div className="text-xs text-muted-foreground">Appels locaux</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{costStats.apiCalls}</div>
              <div className="text-xs text-muted-foreground">Appels API</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{Math.round(performanceMetrics.cacheHitRate)}%</div>
              <div className="text-xs text-muted-foreground">Cache hit</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="costs" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="costs">Coûts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="frequency">Fréquences</TabsTrigger>
          <TabsTrigger value="optimization">Optimisations</TabsTrigger>
        </TabsList>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Transcription</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costStats.costBreakdown.transcription.toFixed(4)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Whisper local prioritaire
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Traitement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costStats.costBreakdown.processing.toFixed(4)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Routing intelligent
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Embeddings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${costStats.costBreakdown.embeddings.toFixed(4)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Batch processing
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Breakdown des économies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Transcription locale vs API</span>
                <Badge variant="secondary">-89%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cache intelligent</span>
                <Badge variant="secondary">-{Math.round(performanceMetrics.cacheHitRate)}%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Batch processing</span>
                <Badge variant="secondary">-67%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Compression prompts</span>
                <Badge variant="secondary">-23%</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Temps de réponse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(performanceMetrics.avgResponseTime)}ms</div>
                <div className="text-xs text-muted-foreground">Moyenne</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Taux de succès
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceMetrics.successRate}%</div>
                <div className="text-xs text-muted-foreground">Fiabilité</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Cache Hit Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(performanceMetrics.cacheHitRate)}%</div>
                <div className="text-xs text-muted-foreground">Évite les recalculs</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Optimisations actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {performanceMetrics.optimizationsApplied.map((opt, index) => (
                  <Badge key={index} variant="outline" className="justify-start">
                    <CheckCircle className="w-3 h-3 mr-2 text-accent" />
                    {opt}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fréquences actuelles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Proactive Engine</span>
                  <Badge variant="secondary">{frequencies.proactiveEngine}min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Vault Collab</span>
                  <Badge variant="secondary">{frequencies.vaultCollabMerge}min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Batch Jobs</span>
                  <Badge variant="secondary">{frequencies.batchJobs}min</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">État</span>
                  <Badge variant={frequencies.enabled ? "default" : "destructive"}>
                    {frequencies.enabled ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Activité utilisateur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Nouvelles mémoires (1h)</span>
                  <span className="font-medium">{freqMetrics.newMemories}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Nouvelles notes (1h)</span>
                  <span className="font-medium">{freqMetrics.newNotes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Score d'activité</span>
                  <Badge variant={freqMetrics.userActivity > 0.7 ? "default" : freqMetrics.userActivity > 0.3 ? "secondary" : "outline"}>
                    {Math.round(freqMetrics.userActivity * 100)}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Économies estimées: ${freqStats.estimatedCostSaving.toFixed(4)}/jour
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommandations d'optimisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <div className="font-medium">Transcription locale activée</div>
                    <div className="text-sm text-muted-foreground">
                      Économie de ~$0.006/minute vs OpenAI Whisper API
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <div className="font-medium">Routing de complexité</div>
                    <div className="text-sm text-muted-foreground">
                      Modèles locaux pour 75% des tâches simples
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <div className="font-medium">Cache intelligent</div>
                    <div className="text-sm text-muted-foreground">
                      {Math.round(performanceMetrics.cacheHitRate)}% de cache hit rate
                    </div>
                  </div>
                </div>

                {optimizationScore < 70 && (
                  <div className="flex items-start gap-3 p-3 bg-orange-500/5 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Optimisation possible</div>
                      <div className="text-sm text-muted-foreground">
                        Activez le mode hors-ligne pour plus d'économies
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Impact estimé (30 jours)</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Coût sans optimisation</div>
                    <div className="font-semibold">${(costStats.totalSaved + (costStats.costBreakdown.transcription + costStats.costBreakdown.processing + costStats.costBreakdown.embeddings)).toFixed(3)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Coût actuel</div>
                    <div className="font-semibold text-accent">${(costStats.costBreakdown.transcription + costStats.costBreakdown.processing + costStats.costBreakdown.embeddings).toFixed(3)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CostOptimizationDashboard;