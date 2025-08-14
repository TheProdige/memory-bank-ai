// Composant pour l'affichage de l'intelligence proactive
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Zap,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { proactiveEngine, ProactiveBrief, ProactiveAction } from '@/core/ai/ProactiveEngine';
import { Logger } from '@/core/logging/Logger';
import { cn } from '@/lib/utils';

interface ProactiveIntelligenceProps {
  className?: string;
}

export const ProactiveIntelligence: React.FC<ProactiveIntelligenceProps> = ({ 
  className 
}) => {
  const [briefs, setBriefs] = useState<ProactiveBrief[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedBrief, setExpandedBrief] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  // Chargement initial
  useEffect(() => {
    loadBriefs();
    const interval = setInterval(loadBriefs, 15 * 60 * 1000); // Toutes les 15 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Chargement des briefs
  const loadBriefs = async () => {
    try {
      // Charger depuis localStorage en attendant l'API
      const stored = localStorage.getItem('proactive_briefs');
      if (stored) {
        const data = JSON.parse(stored);
        setBriefs(data.map((brief: any) => ({
          ...brief,
          generatedAt: new Date(brief.generatedAt),
          eventDate: brief.eventDate ? new Date(brief.eventDate) : undefined
        })));
        setLastUpdate(new Date());
      }
    } catch (error) {
      Logger.error('Failed to load proactive briefs', { error });
    }
  };

  // Traitement forcé
  const forceProcessing = async () => {
    setIsProcessing(true);
    try {
      const newBriefs = await proactiveEngine.forceProcessing();
      
      // Sauvegarder localement
      localStorage.setItem('proactive_briefs', JSON.stringify(newBriefs));
      
      setBriefs(newBriefs);
      setLastUpdate(new Date());
      
      Logger.info('Proactive processing completed', { briefsCount: newBriefs.length });
    } catch (error) {
      Logger.error('Proactive processing failed', { error });
    } finally {
      setIsProcessing(false);
    }
  };

  // Marquer une action comme complétée
  const toggleActionCompleted = (actionId: string) => {
    const newCompleted = new Set(completedActions);
    if (newCompleted.has(actionId)) {
      newCompleted.delete(actionId);
    } else {
      newCompleted.add(actionId);
    }
    setCompletedActions(newCompleted);
    
    // Sauvegarder l'état
    localStorage.setItem('completed_actions', JSON.stringify([...newCompleted]));
  };

  // Chargement des actions complétées
  useEffect(() => {
    const stored = localStorage.getItem('completed_actions');
    if (stored) {
      setCompletedActions(new Set(JSON.parse(stored)));
    }
  }, []);

  // Calcul des statistiques
  const stats = {
    totalBriefs: briefs.length,
    highPriority: briefs.filter(b => b.priority === 'high').length,
    totalActions: briefs.reduce((sum, b) => sum + b.actions.length, 0),
    completedActionsCount: briefs.reduce((sum, b) => 
      sum + b.actions.filter(a => completedActions.has(a.id)).length, 0
    )
  };

  const actionProgress = stats.totalActions > 0 
    ? (stats.completedActionsCount / stats.totalActions) * 100 
    : 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Intelligence Proactive</h2>
            <p className="text-sm text-muted-foreground">
              Briefs contextuels et actions recommandées
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={forceProcessing}
            disabled={isProcessing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isProcessing && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Briefs actifs</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalBriefs}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium">Haute priorité</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.highPriority}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Actions</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {stats.completedActionsCount}/{stats.totalActions}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Progrès</span>
            </div>
            <div className="mt-2 space-y-1">
              <Progress value={actionProgress} className="h-2" />
              <div className="text-sm text-muted-foreground">
                {Math.round(actionProgress)}% complété
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* État de traitement */}
      {isProcessing && (
        <Alert>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <AlertDescription>
            Analyse en cours des événements à venir et génération des briefs...
          </AlertDescription>
        </Alert>
      )}

      {/* Dernière mise à jour */}
      {lastUpdate && (
        <div className="text-sm text-muted-foreground text-center">
          Dernière mise à jour: {lastUpdate.toLocaleString()}
        </div>
      )}

      {/* Liste des briefs */}
      <div className="space-y-4">
        <AnimatePresence>
          {briefs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun brief disponible</h3>
              <p className="text-muted-foreground mb-4">
                Aucun événement détecté pour les prochaines 24 heures
              </p>
              <Button onClick={forceProcessing} disabled={isProcessing}>
                Analyser maintenant
              </Button>
            </motion.div>
          ) : (
            briefs.map((brief) => (
              <BriefCard
                key={brief.id}
                brief={brief}
                isExpanded={expandedBrief === brief.id}
                onToggleExpanded={() => setExpandedBrief(
                  expandedBrief === brief.id ? null : brief.id
                )}
                completedActions={completedActions}
                onToggleAction={toggleActionCompleted}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Composant pour une carte de brief
interface BriefCardProps {
  brief: ProactiveBrief;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  completedActions: Set<string>;
  onToggleAction: (actionId: string) => void;
}

const BriefCard: React.FC<BriefCardProps> = ({
  brief,
  isExpanded,
  onToggleExpanded,
  completedActions,
  onToggleAction
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const timeUntilEvent = brief.eventDate 
    ? brief.eventDate.getTime() - Date.now()
    : 0;
    
  const hoursUntil = Math.max(0, Math.round(timeUntilEvent / (1000 * 60 * 60)));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className={cn(
        "transition-all duration-200 hover:shadow-md",
        brief.priority === 'high' && "border-destructive/50"
      )}>
        <CardHeader className="cursor-pointer" onClick={onToggleExpanded}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={getPriorityColor(brief.priority)}>
                  {brief.priority}
                </Badge>
                {brief.eventDate && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {hoursUntil > 0 ? `dans ${hoursUntil}h` : 'maintenant'}
                  </Badge>
                )}
                <Badge variant="outline">
                  {Math.round(brief.confidence * 100)}% confiance
                </Badge>
              </div>
              
              <CardTitle className="text-lg">{brief.title}</CardTitle>
              <CardDescription className="mt-2">
                {brief.summary}
              </CardDescription>
            </div>
            
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                
                {/* Actions recommandées */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Actions recommandées ({brief.actions.length})
                  </h4>
                  
                  <div className="space-y-2">
                    {brief.actions.map((action) => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        isCompleted={completedActions.has(action.id)}
                        onToggle={() => onToggleAction(action.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Mémoires pertinentes */}
                {brief.relevantMemories.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      Basé sur {brief.relevantMemories.length} mémoire(s) pertinente(s)
                    </h4>
                  </div>
                )}

                {/* Métadonnées */}
                <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                  Généré le {brief.generatedAt.toLocaleString()}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

// Composant pour un élément d'action
interface ActionItemProps {
  action: ProactiveAction;
  isCompleted: boolean;
  onToggle: () => void;
}

const ActionItem: React.FC<ActionItemProps> = ({
  action,
  isCompleted,
  onToggle
}) => {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'remind': return Clock;
      case 'prepare': return Target;
      case 'research': return Lightbulb;
      case 'contact': return Calendar;
      default: return CheckCircle;
    }
  };

  const Icon = getActionIcon(action.type);
  
  const timeUntilDeadline = action.deadline 
    ? action.deadline.getTime() - Date.now()
    : 0;
    
  const isUrgent = timeUntilDeadline > 0 && timeUntilDeadline < 2 * 60 * 60 * 1000; // 2h

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all",
        isCompleted && "opacity-60 bg-muted/50",
        isUrgent && !isCompleted && "border-destructive/50 bg-destructive/5"
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="p-0 w-6 h-6"
        onClick={onToggle}
      >
        {isCompleted ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
        )}
      </Button>
      
      <Icon className={cn(
        "w-4 h-4",
        isCompleted ? "text-muted-foreground" : "text-primary"
      )} />
      
      <div className="flex-1">
        <p className={cn(
          "text-sm",
          isCompleted && "line-through text-muted-foreground"
        )}>
          {action.text}
        </p>
        
        {action.deadline && !isCompleted && (
          <div className={cn(
            "text-xs mt-1",
            isUrgent ? "text-destructive font-medium" : "text-muted-foreground"
          )}>
            {isUrgent && "⚠️ "}
            Échéance: {action.deadline.toLocaleString()}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProactiveIntelligence;