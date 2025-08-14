// Composant de configuration et toggles pour EchoVault
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Zap, 
  Brain, 
  DollarSign, 
  Mic, 
  Shield, 
  RefreshCw,
  Info,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { costEnforcer } from '@/core/ai/CostEnforcer';
import { proactiveEngine } from '@/core/ai/ProactiveEngine';
import { Logger } from '@/core/logging/Logger';
import { cn } from '@/lib/utils';

interface ConfigurationFlags {
  // Intelligence proactive
  proactiveEnabled: boolean;
  proactiveInterval: number; // minutes
  
  // Cost Enforcer
  costEnforcerEnabled: boolean;
  dailyBudget: number; // USD
  enableBatching: boolean;
  enableCaching: boolean;
  
  // Transcription
  whisperModel: 'tiny' | 'small';
  vadEnabled: boolean;
  
  // Sécurité
  localOnlyMode: boolean;
  auditLogging: boolean;
  
  // Performance
  maxConcurrentJobs: number;
  cacheRetentionDays: number;
}

const DEFAULT_CONFIG: ConfigurationFlags = {
  proactiveEnabled: true,
  proactiveInterval: 15,
  costEnforcerEnabled: true,
  dailyBudget: 5.0,
  enableBatching: true,
  enableCaching: true,
  whisperModel: 'tiny',
  vadEnabled: true,
  localOnlyMode: true,
  auditLogging: true,
  maxConcurrentJobs: 3,
  cacheRetentionDays: 7
};

export const ConfigurationPanel: React.FC = () => {
  const [config, setConfig] = useState<ConfigurationFlags>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Chargement de la configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = () => {
    try {
      const stored = localStorage.getItem('echovault_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      }
    } catch (error) {
      Logger.error('Failed to load configuration', { error });
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // Sauvegarder localement
      localStorage.setItem('echovault_config', JSON.stringify(config));
      
      // Appliquer les configurations aux modules
      await applyConfiguration(config);
      
      setHasChanges(false);
      setLastSaved(new Date());
      
      Logger.info('Configuration saved', { config });
    } catch (error) {
      Logger.error('Failed to save configuration', { error });
    } finally {
      setIsSaving(false);
    }
  };

  const applyConfiguration = async (newConfig: ConfigurationFlags) => {
    // Appliquer au Cost Enforcer
    if (newConfig.costEnforcerEnabled) {
      costEnforcer.setConstraints({
        dailyBudgetUSD: newConfig.dailyBudget,
        enableCaching: newConfig.enableCaching,
        enableBatching: newConfig.enableBatching
      });
    }
    
    // Configuration globale
    (window as any).ECHOVAULT_CONFIG = {
      WHISPER_MODEL: newConfig.whisperModel,
      VAD_ENABLED: newConfig.vadEnabled,
      LOCAL_ONLY_MODE: newConfig.localOnlyMode,
      AUDIT_LOGGING: newConfig.auditLogging,
      MAX_CONCURRENT_JOBS: newConfig.maxConcurrentJobs
    };
  };

  const updateConfig = (key: keyof ConfigurationFlags, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
  };

  const getModelDescription = (model: string) => {
    switch (model) {
      case 'tiny': return 'Rapide, léger (39MB) - Qualité standard';
      case 'small': return 'Plus précis (244MB) - Qualité améliorée';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Paramètres avancés et optimisations
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600">
              Modifications non sauvées
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            disabled={isSaving}
          >
            Réinitialiser
          </Button>
          <Button
            onClick={saveConfiguration}
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* État du mode local-only */}
      {config.localOnlyMode && (
        <Alert>
          <Shield className="w-4 h-4" />
          <AlertDescription>
            Mode local-only activé - Aucun appel externe ne sera effectué
          </AlertDescription>
        </Alert>
      )}

      {/* Intelligence Proactive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Intelligence Proactive
          </CardTitle>
          <CardDescription>
            Génération automatique de briefs contextuels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="proactive-enabled">Activer l'intelligence proactive</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Briefs automatiques avant les événements détectés
              </p>
            </div>
            <Switch
              id="proactive-enabled"
              checked={config.proactiveEnabled}
              onCheckedChange={(checked) => updateConfig('proactiveEnabled', checked)}
            />
          </div>
          
          {config.proactiveEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div>
                <Label>Intervalle de traitement: {config.proactiveInterval} minutes</Label>
                <Slider
                  value={[config.proactiveInterval]}
                  onValueChange={([value]) => updateConfig('proactiveInterval', value)}
                  min={5}
                  max={60}
                  step={5}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>5 min</span>
                  <span>60 min</span>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Contrôle des coûts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Contrôle des coûts
          </CardTitle>
          <CardDescription>
            Politique anti-coût et optimisations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="cost-enforcer">Activer le contrôle des coûts</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Quotas journaliers et optimisations automatiques
              </p>
            </div>
            <Switch
              id="cost-enforcer"
              checked={config.costEnforcerEnabled}
              onCheckedChange={(checked) => updateConfig('costEnforcerEnabled', checked)}
            />
          </div>
          
          {config.costEnforcerEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div>
                <Label>Budget journalier: ${config.dailyBudget.toFixed(2)}</Label>
                <Slider
                  value={[config.dailyBudget]}
                  onValueChange={([value]) => updateConfig('dailyBudget', value)}
                  min={1}
                  max={20}
                  step={0.5}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>$1</span>
                  <span>$20</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="batching">Batching automatique</Label>
                  <Switch
                    id="batching"
                    checked={config.enableBatching}
                    onCheckedChange={(checked) => updateConfig('enableBatching', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="caching">Cache intelligent</Label>
                  <Switch
                    id="caching"
                    checked={config.enableCaching}
                    onCheckedChange={(checked) => updateConfig('enableCaching', checked)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Transcription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Transcription
          </CardTitle>
          <CardDescription>
            Configuration du moteur de transcription local
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="whisper-model">Modèle Whisper</Label>
            <Select
              value={config.whisperModel}
              onValueChange={(value: 'tiny' | 'small') => updateConfig('whisperModel', value)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiny">
                  <div>
                    <div className="font-medium">Tiny</div>
                    <div className="text-xs text-muted-foreground">
                      {getModelDescription('tiny')}
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="small">
                  <div>
                    <div className="font-medium">Small</div>
                    <div className="text-xs text-muted-foreground">
                      {getModelDescription('small')}
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="vad-enabled">Détection d'activité vocale (VAD)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Suppression automatique des silences
              </p>
            </div>
            <Switch
              id="vad-enabled"
              checked={config.vadEnabled}
              onCheckedChange={(checked) => updateConfig('vadEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sécurité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Sécurité & Confidentialité
          </CardTitle>
          <CardDescription>
            Paramètres de sécurité et d'audit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="local-only">Mode local uniquement</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Aucun appel externe - Traitement 100% local
              </p>
            </div>
            <Switch
              id="local-only"
              checked={config.localOnlyMode}
              onCheckedChange={(checked) => updateConfig('localOnlyMode', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="audit-logging">Journalisation d'audit</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Traçabilité des accès et modifications
              </p>
            </div>
            <Switch
              id="audit-logging"
              checked={config.auditLogging}
              onCheckedChange={(checked) => updateConfig('auditLogging', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Performance
          </CardTitle>
          <CardDescription>
            Optimisations et limites de traitement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Jobs concurrents maximum: {config.maxConcurrentJobs}</Label>
            <Slider
              value={[config.maxConcurrentJobs]}
              onValueChange={([value]) => updateConfig('maxConcurrentJobs', value)}
              min={1}
              max={10}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
          
          <div>
            <Label>Rétention cache: {config.cacheRetentionDays} jours</Label>
            <Slider
              value={[config.cacheRetentionDays]}
              onValueChange={([value]) => updateConfig('cacheRetentionDays', value)}
              min={1}
              max={30}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1 jour</span>
              <span>30 jours</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dernière sauvegarde */}
      {lastSaved && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Dernière sauvegarde: {lastSaved.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;