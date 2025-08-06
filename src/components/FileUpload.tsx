import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileAudio, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  onFileSelected: (file: File, audioUrl: string) => void;
  acceptedFormats?: string[];
  maxSize?: number; // in MB
  disabled?: boolean;
}

export const FileUpload = ({ 
  onFileSelected, 
  acceptedFormats = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'],
  maxSize = 50,
  disabled = false
}: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Vérifier le type de fichier
    const isAudio = file.type.startsWith('audio/');
    const hasValidExtension = acceptedFormats.some(format => 
      file.name.toLowerCase().endsWith(format.toLowerCase())
    );

    if (!isAudio && !hasValidExtension) {
      return `Format non supporté. Formats acceptés: ${acceptedFormats.join(', ')}`;
    }

    // Vérifier la taille
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > maxSize) {
      return `Fichier trop volumineux. Taille maximum: ${maxSize}MB`;
    }

    return null;
  };

  const processFile = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Simuler le progrès d'upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      // Créer URL pour l'audio
      const audioUrl = URL.createObjectURL(file);
      
      // Attendre un peu pour l'effet visuel
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      onFileSelected(file, audioUrl);
      toast.success(`Fichier "${file.name}" chargé avec succès`);
      
    } catch (error) {
      console.error('Erreur lors du traitement du fichier:', error);
      toast.error("Erreur lors du chargement du fichier");
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <Card 
        className={`
          transition-all duration-200 cursor-pointer
          ${isDragOver ? 'border-accent bg-accent/5 shadow-gold-glow' : 'border-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent/50'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleButtonClick}
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className={`
              w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center
              ${isDragOver ? 'border-accent bg-accent/10' : 'border-muted-foreground/30'}
            `}>
              {isProcessing ? (
                <div className="animate-spin">
                  <Upload className="w-8 h-8 text-accent" />
                </div>
              ) : (
                <FileAudio className={`w-8 h-8 ${isDragOver ? 'text-accent' : 'text-muted-foreground'}`} />
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">
                {isProcessing ? 'Traitement en cours...' : 'Glissez votre fichier audio ici'}
              </h3>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner un fichier
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {acceptedFormats.map(format => (
                <Badge key={format} variant="secondary" className="text-xs">
                  {format.toUpperCase()}
                </Badge>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Taille maximum: {maxSize}MB
            </p>
          </div>
        </CardContent>
      </Card>

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Chargement...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};