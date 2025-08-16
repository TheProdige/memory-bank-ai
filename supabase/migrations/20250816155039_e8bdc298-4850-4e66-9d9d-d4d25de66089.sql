-- Fix missing RLS policies based on security scan results

-- Add UPDATE and DELETE policies for ai_cache table
CREATE POLICY "Users can update their own ai_cache" 
ON public.ai_cache 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai_cache" 
ON public.ai_cache 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add UPDATE and DELETE policies for ai_logs table  
CREATE POLICY "Users can update their own ai_logs" 
ON public.ai_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai_logs" 
ON public.ai_logs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add UPDATE policy for memory_chunks table
CREATE POLICY "Users can update their own memory_chunks" 
ON public.memory_chunks 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add UPDATE and DELETE policies for proactive_events table
CREATE POLICY "Users can update their own proactive_events" 
ON public.proactive_events 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proactive_events" 
ON public.proactive_events 
FOR DELETE 
USING (auth.uid() = user_id);