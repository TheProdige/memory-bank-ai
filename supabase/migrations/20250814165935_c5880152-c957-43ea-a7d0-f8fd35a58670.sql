-- Create storage buckets for file management
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  ('images', 'images', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
  ('media', 'media', false, 52428800, ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'video/mp4', 'video/webm']);

-- Create files table for metadata and indexing
CREATE TABLE IF NOT EXISTS public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vault_id UUID NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  bucket_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  
  -- Content and indexing
  extracted_text TEXT NULL,
  is_indexed BOOLEAN NOT NULL DEFAULT false,
  is_local_processed BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  
  -- Security and encryption
  encryption_key_id TEXT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  metadata JSONB NULL,
  tags TEXT[] NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for files
CREATE POLICY "Users can view their own files" 
ON public.files 
FOR SELECT 
USING (auth.uid() = user_id OR (vault_id IS NOT NULL AND is_current_user_vault_member(vault_id)));

CREATE POLICY "Users can insert their own files" 
ON public.files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND (vault_id IS NULL OR is_current_user_vault_member(vault_id)));

CREATE POLICY "Users can update their own files" 
ON public.files 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" 
ON public.files 
FOR DELETE 
USING (auth.uid() = user_id);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for images bucket (public)
CREATE POLICY "Images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'images');

CREATE POLICY "Users can upload their own images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for media bucket
CREATE POLICY "Users can view their own media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own media" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();