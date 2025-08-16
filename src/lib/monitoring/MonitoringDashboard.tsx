/**
 * World-class Monitoring & Observability System
 * Real-time metrics, performance tracking, and analytics dashboard
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  DollarSign,
  Download,
  HardDrive,
  Monitor,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  FileText,
  Upload,
  Search,
  Settings
} from 'lucide-react'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Logger } from '@/core/logging/Logger'
import { useAccessibility } from '@/lib/accessibility/AccessibilityEnhancer'

interface MetricValue {
  current: number
  previous: number
  trend: 'up' | 'down' | 'stable'
  formatted: string
  unit: string
}

interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  timestamp: Date
  resolved: boolean
}

interface PerformanceMetrics {
  // Core Performance
  avgResponseTime: MetricValue
  errorRate: MetricValue
  throughput: MetricValue
  
  // Resource Usage
  memoryUsage: MetricValue
  cpuUsage: MetricValue
  storageUsage: MetricValue
  
  // Business Metrics
  totalFiles: MetricValue
  dailyUploads: MetricValue
  aiRequestsToday: MetricValue
  costToday: MetricValue
  
  // User Experience
  pageLoadTime: MetricValue
  cacheHitRate: MetricValue
  searchLatency: MetricValue
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical'
  services: {
    api: 'online' | 'degraded' | 'offline'
    database: 'online' | 'degraded' | 'offline'
    storage: 'online' | 'degraded' | 'offline'
    ai: 'online' | 'degraded' | 'offline'
  }
  uptime: number
  lastUpdated: Date
}

export function MonitoringDashboard() {
  const { announceMessage } = useAccessibility()
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch metrics data
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Simulate fetching metrics from backend
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data - in production, fetch from real monitoring service
      const mockMetrics: PerformanceMetrics = {
        avgResponseTime: {
          current: 245,
          previous: 289,
          trend: 'down',
          formatted: '245ms',
          unit: 'ms'
        },
        errorRate: {
          current: 0.2,
          previous: 0.8,
          trend: 'down',
          formatted: '0.2%',
          unit: '%'
        },
        throughput: {
          current: 1247,
          previous: 1103,
          trend: 'up',
          formatted: '1.2k',
          unit: 'req/min'
        },
        memoryUsage: {
          current: 68,
          previous: 72,
          trend: 'down',
          formatted: '68%',
          unit: '%'
        },
        cpuUsage: {
          current: 23,
          previous: 31,
          trend: 'down',
          formatted: '23%',
          unit: '%'
        },
        storageUsage: {
          current: 45,
          previous: 42,
          trend: 'up',
          formatted: '45%',
          unit: '%'
        },
        totalFiles: {
          current: 1247,
          previous: 1203,
          trend: 'up',
          formatted: '1.2k',
          unit: 'files'
        },
        dailyUploads: {
          current: 89,
          previous: 76,
          trend: 'up',
          formatted: '89',
          unit: 'uploads'
        },
        aiRequestsToday: {
          current: 234,
          previous: 198,
          trend: 'up',
          formatted: '234',
          unit: 'requests'
        },
        costToday: {
          current: 2.47,
          previous: 3.12,
          trend: 'down',
          formatted: '$2.47',
          unit: 'USD'
        },
        pageLoadTime: {
          current: 1.2,
          previous: 1.8,
          trend: 'down',
          formatted: '1.2s',
          unit: 's'
        },
        cacheHitRate: {
          current: 94.2,
          previous: 91.8,
          trend: 'up',
          formatted: '94.2%',
          unit: '%'
        },
        searchLatency: {
          current: 89,
          previous: 124,
          trend: 'down',
          formatted: '89ms',
          unit: 'ms'
        }
      }
      
      const mockHealth: SystemHealth = {
        overall: 'healthy',
        services: {
          api: 'online',
          database: 'online',
          storage: 'online',
          ai: 'online'
        },
        uptime: 99.97,
        lastUpdated: new Date()
      }
      
      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'warning',
          message: 'Cache hit rate below 95% threshold',
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          resolved: false
        },
        {
          id: '2',
          type: 'info',
          message: 'Storage usage approaching 50% capacity',
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          resolved: false
        }
      ]
      
      setMetrics(mockMetrics)
      setHealth(mockHealth)
      setAlerts(mockAlerts)
      
      Logger.info('Metrics fetched successfully', {
        timeframe: selectedTimeframe,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      Logger.error('Failed to fetch metrics', { error })
      announceMessage('Erreur lors du chargement des métriques')
    } finally {
      setIsLoading(false)
    }
  }, [selectedTimeframe, announceMessage])

  // Auto-refresh effect
  useEffect(() => {
    fetchMetrics()
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [fetchMetrics, autoRefresh])

  // Metric card component
  const MetricCard = useCallback(({ 
    title, 
    metric, 
    icon: Icon, 
    color = 'default' 
  }: {
    title: string
    metric: MetricValue
    icon: React.ElementType
    color?: 'default' | 'green' | 'red' | 'blue' | 'yellow'
  }) => {
    const colorClasses = {
      default: 'text-foreground',
      green: 'text-emerald-600',
      red: 'text-red-600',
      blue: 'text-blue-600',
      yellow: 'text-yellow-600'
    }
    
    const trendIcon = metric.trend === 'up' ? TrendingUp : 
                     metric.trend === 'down' ? TrendingDown : 
                     null
    
    const trendColor = metric.trend === 'up' ? 'text-emerald-600' : 
                      metric.trend === 'down' ? 'text-red-600' : 
                      'text-muted-foreground'
    
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${colorClasses[color]}`}>
                  {metric.formatted}
                </span>
                {trendIcon && (
                  <div className="flex items-center space-x-1">
                    {React.createElement(trendIcon, { 
                      className: `w-4 h-4 ${trendColor}`,
                      'aria-hidden': true
                    })}
                    <span className={`text-xs ${trendColor}`}>
                      {Math.abs(((metric.current - metric.previous) / metric.previous * 100)).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Icon className={`w-8 h-8 ${colorClasses[color]} opacity-80`} />
          </div>
        </CardContent>
      </Card>
    )
  }, [])

  // Service status component
  const ServiceStatus = useCallback(({ 
    name, 
    status 
  }: { 
    name: string
    status: 'online' | 'degraded' | 'offline' 
  }) => {
    const statusConfig = {
      online: { color: 'bg-emerald-500', text: 'En ligne', textColor: 'text-emerald-700' },
      degraded: { color: 'bg-yellow-500', text: 'Dégradé', textColor: 'text-yellow-700' },
      offline: { color: 'bg-red-500', text: 'Hors ligne', textColor: 'text-red-700' }
    }
    
    const config = statusConfig[status]
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <span className="font-medium">{name}</span>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${config.color}`} />
          <span className={`text-sm ${config.textColor}`}>{config.text}</span>
        </div>
      </div>
    )
  }, [])

  if (isLoading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!metrics || !health) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Impossible de charger les métriques. Veuillez réessayer.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6" role="main" aria-label="Tableau de bord de monitoring">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monitoring & Observabilité</h2>
          <p className="text-muted-foreground">
            Dernière mise à jour: {formatDistance(health.lastUpdated, new Date(), { 
              addSuffix: true, 
              locale: fr 
            })}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Timeframe selector */}
          <div className="flex space-x-1 bg-muted rounded-lg p-1">
            {(['1h', '24h', '7d', '30d'] as const).map((timeframe) => (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe)}
                className="h-8"
              >
                {timeframe}
              </Button>
            ))}
          </div>
          
          {/* Auto-refresh toggle */}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-pressed={autoRefresh}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto
          </Button>
          
          {/* Manual refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="w-5 h-5" />
            <span>État du système</span>
            <Badge 
              variant={health.overall === 'healthy' ? 'default' : 'destructive'}
              className={health.overall === 'healthy' ? 'bg-emerald-500' : ''}
            >
              {health.overall === 'healthy' ? 'Sain' : 
               health.overall === 'warning' ? 'Attention' : 'Critique'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ServiceStatus name="API" status={health.services.api} />
            <ServiceStatus name="Base de données" status={health.services.database} />
            <ServiceStatus name="Stockage" status={health.services.storage} />
            <ServiceStatus name="IA" status={health.services.ai} />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Temps de fonctionnement</span>
            <div className="text-right">
              <div className="font-medium">{health.uptime}%</div>
              <Progress value={health.uptime} className="w-24 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Alertes actives</span>
              <Badge variant="secondary">{alerts.filter(a => !a.resolved).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.filter(a => !a.resolved).map((alert) => (
              <Alert key={alert.id} variant={alert.type === 'error' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{alert.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistance(alert.timestamp, new Date(), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </span>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Temps de réponse moyen"
          metric={metrics.avgResponseTime}
          icon={Clock}
          color="blue"
        />
        <MetricCard
          title="Taux d'erreur"
          metric={metrics.errorRate}
          icon={AlertTriangle}
          color="red"
        />
        <MetricCard
          title="Débit"
          metric={metrics.throughput}
          icon={Activity}
          color="green"
        />
      </div>

      {/* Resource Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5" />
            <span>Utilisation des ressources</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Mémoire</span>
                <span className="text-sm text-muted-foreground">{metrics.memoryUsage.formatted}</span>
              </div>
              <Progress value={metrics.memoryUsage.current} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">CPU</span>
                <span className="text-sm text-muted-foreground">{metrics.cpuUsage.formatted}</span>
              </div>
              <Progress value={metrics.cpuUsage.current} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Stockage</span>
                <span className="text-sm text-muted-foreground">{metrics.storageUsage.formatted}</span>
              </div>
              <Progress value={metrics.storageUsage.current} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Fichiers totaux"
          metric={metrics.totalFiles}
          icon={FileText}
          color="blue"
        />
        <MetricCard
          title="Uploads aujourd'hui"
          metric={metrics.dailyUploads}
          icon={Upload}
          color="green"
        />
        <MetricCard
          title="Requêtes IA"
          metric={metrics.aiRequestsToday}
          icon={Zap}
          color="yellow"
        />
        <MetricCard
          title="Coût aujourd'hui"
          metric={metrics.costToday}
          icon={DollarSign}
          color="red"
        />
      </div>

      {/* User Experience Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>Expérience utilisateur</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center space-y-2">
              <Clock className="w-8 h-8 mx-auto text-blue-600" />
              <div className="font-medium">Temps de chargement</div>
              <div className="text-2xl font-bold text-blue-600">{metrics.pageLoadTime.formatted}</div>
            </div>
            
            <div className="text-center space-y-2">
              <Database className="w-8 h-8 mx-auto text-green-600" />
              <div className="font-medium">Taux de cache</div>
              <div className="text-2xl font-bold text-green-600">{metrics.cacheHitRate.formatted}</div>
            </div>
            
            <div className="text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-purple-600" />
              <div className="font-medium">Latence recherche</div>
              <div className="text-2xl font-bold text-purple-600">{metrics.searchLatency.formatted}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}