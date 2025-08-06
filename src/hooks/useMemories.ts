import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Memory {
  id: string;
  title: string;
  transcript: string;
  summary: string;
  emotion: string;
  tags: string[];
  audio_url?: string;
  created_at: string;
  updated_at: string;
}

export const useMemories = () => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchMemories();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchMemories = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemories(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des mémoires:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMemory = (newMemory: Memory) => {
    setMemories(prev => [newMemory, ...prev]);
  };

  const deleteMemory = async (memoryId: string) => {
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setMemories(prev => prev.filter(memory => memory.id !== memoryId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      throw error;
    }
  };

  const updateMemory = async (memoryId: string, updates: Partial<Memory>) => {
    try {
      const { error } = await supabase
        .from('memories')
        .update(updates)
        .eq('id', memoryId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setMemories(prev => 
        prev.map(memory => 
          memory.id === memoryId 
            ? { ...memory, ...updates }
            : memory
        )
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      throw error;
    }
  };

  const filteredMemories = memories.filter(memory => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      memory.title.toLowerCase().includes(query) ||
      memory.transcript.toLowerCase().includes(query) ||
      memory.summary?.toLowerCase().includes(query) ||
      memory.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  return {
    memories: filteredMemories,
    allMemories: memories,
    loading,
    searchQuery,
    setSearchQuery,
    fetchMemories,
    addMemory,
    deleteMemory,
    updateMemory
  };
};