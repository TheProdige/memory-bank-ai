import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UsageLimits {
  memoriesCount: number;
  dailyLimit: number;
  dailyUsed: number;
  canCreateMemory: boolean;
  subscriptionTier: 'free' | 'pro';
}

export const useUsageLimits = () => {
  const { user } = useAuth();
  const [limits, setLimits] = useState<UsageLimits>({
    memoriesCount: 0,
    dailyLimit: 10,
    dailyUsed: 0,
    canCreateMemory: true,
    subscriptionTier: 'free'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUsageLimits();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUsageLimits = async () => {
    if (!user) return;

    try {
      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('memories_count, subscription_tier')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        // Calculer l'usage du jour
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: dailyUsed } = await supabase
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString());

        const dailyLimit = profile.subscription_tier === 'pro' ? 100 : 10;
        const canCreateMemory = (dailyUsed || 0) < dailyLimit;

        setLimits({
          memoriesCount: profile.memories_count || 0,
          dailyLimit,
          dailyUsed: dailyUsed || 0,
          canCreateMemory,
          subscriptionTier: (profile.subscription_tier as 'free' | 'pro') || 'free'
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des limites:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementUsage = () => {
    setLimits(prev => ({
      ...prev,
      memoriesCount: prev.memoriesCount + 1,
      dailyUsed: prev.dailyUsed + 1,
      canCreateMemory: (prev.dailyUsed + 1) < prev.dailyLimit
    }));
  };

  return {
    ...limits,
    loading,
    refetch: fetchUsageLimits,
    incrementUsage
  };
};