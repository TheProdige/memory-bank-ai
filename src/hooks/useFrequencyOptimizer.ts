import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface FrequencySettings {
  proactiveEngine: number; // minutes
  vaultCollabMerge: number; // minutes  
  batchJobs: number; // minutes
  enabled: boolean;
}

interface ActivityMetrics {
  newMemories: number;
  newNotes: number;
  userActivity: number; // score 0-1
  lastActivity: Date | null;
}

const DEFAULT_FREQUENCIES: FrequencySettings = {
  proactiveEngine: 60, // 1 heure par défaut
  vaultCollabMerge: 30, // 30 minutes
  batchJobs: 15, // 15 minutes
  enabled: true
};

const ADAPTIVE_THRESHOLDS = {
  highActivity: { memories: 5, notes: 10, scoreThreshold: 0.8 },
  mediumActivity: { memories: 2, notes: 5, scoreThreshold: 0.5 },
  lowActivity: { memories: 0, notes: 0, scoreThreshold: 0.2 }
};

export const useFrequencyOptimizer = () => {
  const { user } = useAuth();
  const [frequencies, setFrequencies] = useState<FrequencySettings>(DEFAULT_FREQUENCIES);
  const [metrics, setMetrics] = useState<ActivityMetrics>({
    newMemories: 0,
    newNotes: 0,
    userActivity: 0,
    lastActivity: null
  });
  const [loading, setLoading] = useState(false);

  // Calculer les métriques d'activité
  const calculateActivityMetrics = useCallback(async (): Promise<ActivityMetrics> => {
    if (!user) return metrics;

    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Compter les nouvelles mémoires dans la dernière heure
      const { count: newMemories } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneHourAgo.toISOString());

      // Compter les nouvelles notes dans la dernière heure
      const { count: newNotes } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneHourAgo.toISOString());

      // Récupérer la dernière activité
      const { data: lastMemory } = await supabase
        .from('memories')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: lastNote } = await supabase
        .from('notes')
        .select('updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      // Déterminer la dernière activité
      const memoryTime = lastMemory ? new Date(lastMemory.created_at) : null;
      const noteTime = lastNote ? new Date(lastNote.updated_at) : null;
      const lastActivity = memoryTime && noteTime 
        ? (memoryTime > noteTime ? memoryTime : noteTime)
        : memoryTime || noteTime;

      // Calculer score d'activité (basé sur fréquence et récence)
      let activityScore = 0;
      if (lastActivity) {
        const timeSinceActivity = now.getTime() - lastActivity.getTime();
        const hoursAgo = timeSinceActivity / (1000 * 60 * 60);
        
        // Score décroissant basé sur le temps écoulé
        if (hoursAgo < 1) activityScore += 0.8;
        else if (hoursAgo < 6) activityScore += 0.6;
        else if (hoursAgo < 24) activityScore += 0.4;
        else if (hoursAgo < 72) activityScore += 0.2;
      }

      // Ajouter score basé sur volume d'activité
      activityScore += Math.min(0.4, (newMemories || 0) * 0.1 + (newNotes || 0) * 0.05);

      return {
        newMemories: newMemories || 0,
        newNotes: newNotes || 0,
        userActivity: Math.min(1, activityScore),
        lastActivity
      };

    } catch (error) {
      console.error('Erreur calcul métriques:', error);
      return metrics;
    }
  }, [user, metrics]);

  // Optimiser les fréquences selon l'activité
  const optimizeFrequencies = useCallback((activityMetrics: ActivityMetrics): FrequencySettings => {
    const { newMemories, newNotes, userActivity } = activityMetrics;
    
    // Déterminer le niveau d'activité
    let activityLevel: 'high' | 'medium' | 'low' = 'low';
    
    if (newMemories >= ADAPTIVE_THRESHOLDS.highActivity.memories || 
        newNotes >= ADAPTIVE_THRESHOLDS.highActivity.notes ||
        userActivity >= ADAPTIVE_THRESHOLDS.highActivity.scoreThreshold) {
      activityLevel = 'high';
    } else if (newMemories >= ADAPTIVE_THRESHOLDS.mediumActivity.memories || 
               newNotes >= ADAPTIVE_THRESHOLDS.mediumActivity.notes ||
               userActivity >= ADAPTIVE_THRESHOLDS.mediumActivity.scoreThreshold) {
      activityLevel = 'medium';
    }

    // Ajuster les fréquences selon l'activité
    let newFrequencies: FrequencySettings;

    switch (activityLevel) {
      case 'high':
        newFrequencies = {
          proactiveEngine: 10, // Très fréquent
          vaultCollabMerge: 5,
          batchJobs: 2,
          enabled: true
        };
        break;
      
      case 'medium':
        newFrequencies = {
          proactiveEngine: 30,
          vaultCollabMerge: 15,
          batchJobs: 10,
          enabled: true
        };
        break;
      
      case 'low':
      default:
        newFrequencies = {
          proactiveEngine: 240, // 4 heures - très peu fréquent
          vaultCollabMerge: 120, // 2 heures
          batchJobs: 60, // 1 heure
          enabled: userActivity > 0 // Désactiver si pas d'activité du tout
        };
        break;
    }

    return newFrequencies;
  }, []);

  // Appliquer les nouvelles fréquences via la base de données
  const applyFrequencies = useCallback(async (newFrequencies: FrequencySettings) => {
    if (!user) return;

    try {
      setLoading(true);

      // Mettre à jour les cron jobs via une fonction edge
      const { error } = await supabase.functions.invoke('update-frequencies', {
        body: {
          userId: user.id,
          frequencies: newFrequencies
        }
      });

      if (error) {
        console.error('Erreur mise à jour fréquences:', error);
        return;
      }

      setFrequencies(newFrequencies);
      
      console.log('Fréquences optimisées:', {
        activity: metrics.userActivity,
        newFreqs: newFrequencies
      });

    } catch (error) {
      console.error('Erreur application fréquences:', error);
    } finally {
      setLoading(false);
    }
  }, [user, metrics]);

  // Fonction principale d'optimisation
  const optimizeAll = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Calculer métriques d'activité
      const newMetrics = await calculateActivityMetrics();
      setMetrics(newMetrics);

      // 2. Optimiser fréquences
      const optimizedFreqs = optimizeFrequencies(newMetrics);

      // 3. Appliquer seulement si changement significatif
      const shouldUpdate = 
        Math.abs(optimizedFreqs.proactiveEngine - frequencies.proactiveEngine) > 5 ||
        Math.abs(optimizedFreqs.vaultCollabMerge - frequencies.vaultCollabMerge) > 5 ||
        optimizedFreqs.enabled !== frequencies.enabled;

      if (shouldUpdate) {
        await applyFrequencies(optimizedFreqs);
      }

    } catch (error) {
      console.error('Erreur optimisation complète:', error);
    } finally {
      setLoading(false);
    }
  }, [user, calculateActivityMetrics, optimizeFrequencies, applyFrequencies, frequencies]);

  // Auto-optimisation périodique
  useEffect(() => {
    if (!user) return;

    // Optimiser au démarrage
    optimizeAll();

    // Puis toutes les 30 minutes
    const interval = setInterval(optimizeAll, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, optimizeAll]);

  // Fonctions manuelles
  const enableAll = useCallback(() => {
    const newFreqs = { ...frequencies, enabled: true };
    applyFrequencies(newFreqs);
  }, [frequencies, applyFrequencies]);

  const disableAll = useCallback(() => {
    const newFreqs = { ...frequencies, enabled: false };
    applyFrequencies(newFreqs);
  }, [frequencies, applyFrequencies]);

  const resetToDefaults = useCallback(() => {
    applyFrequencies(DEFAULT_FREQUENCIES);
  }, [applyFrequencies]);

  return {
    frequencies,
    metrics,
    loading,
    optimizeAll,
    enableAll,
    disableAll,
    resetToDefaults,
    
    // Stats pour le rapport
    getOptimizationStats: () => ({
      currentActivity: metrics.userActivity,
      frequencies,
      estimatedCostSaving: calculateCostSaving(frequencies),
      nextOptimization: new Date(Date.now() + 30 * 60 * 1000) // 30 min
    })
  };
};

// Calculer les économies estimées
function calculateCostSaving(frequencies: FrequencySettings): number {
  const defaultCalls = (60 / DEFAULT_FREQUENCIES.proactiveEngine) + 
                      (60 / DEFAULT_FREQUENCIES.vaultCollabMerge);
  
  const optimizedCalls = frequencies.enabled 
    ? (60 / frequencies.proactiveEngine) + (60 / frequencies.vaultCollabMerge)
    : 0;
  
  const reduction = Math.max(0, defaultCalls - optimizedCalls);
  
  // Estimation: chaque appel = ~$0.001
  return reduction * 0.001 * 24; // Par jour
}