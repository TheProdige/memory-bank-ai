import { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Calendar,
  Clock,
  Heart,
  Brain,
  Smile,
  Frown,
  Meh
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MemoryCardProps {
  memory: {
    id: string;
    title: string;
    transcript: string;
    summary?: string;
    emotion?: string;
    tags?: string[];
    audio_url?: string;
    created_at: string;
  };
  onPlay?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isPlaying?: boolean;
}

const getEmotionIcon = (emotion?: string) => {
  if (!emotion) return <Brain className="w-4 h-4" />;
  
  const emotionLower = emotion.toLowerCase();
  
  if (emotionLower.includes('joyeux') || emotionLower.includes('heureux') || emotionLower.includes('content')) {
    return <Smile className="w-4 h-4 text-green-500" />;
  }
  if (emotionLower.includes('triste') || emotionLower.includes('mélancolique')) {
    return <Frown className="w-4 h-4 text-blue-500" />;
  }
  if (emotionLower.includes('neutre') || emotionLower.includes('calme')) {
    return <Meh className="w-4 h-4 text-muted-foreground" />;
  }
  if (emotionLower.includes('passionné') || emotionLower.includes('enthousiaste')) {
    return <Heart className="w-4 h-4 text-red-500" />;
  }
  
  return <Brain className="w-4 h-4 text-accent" />;
};

export const MemoryCard = ({ 
  memory, 
  onPlay, 
  onEdit, 
  onDelete, 
  isPlaying = false 
}: MemoryCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(memory.created_at), {
    addSuffix: true,
    locale: fr
  });

  const truncatedTranscript = memory.transcript.length > 150 
    ? memory.transcript.slice(0, 150) + '...'
    : memory.transcript;

  return (
    <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg leading-tight mb-2">
              {memory.title}
            </h3>
            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{timeAgo}</span>
              </div>
              {memory.emotion && (
                <div className="flex items-center space-x-1">
                  {getEmotionIcon(memory.emotion)}
                  <span className="capitalize">{memory.emotion}</span>
                </div>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Audio Controls */}
        {memory.audio_url && onPlay && (
          <div className="flex items-center space-x-2 mb-4 p-3 bg-muted/30 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPlay}
              className="h-8 w-8 p-0 rounded-full bg-accent/10 hover:bg-accent/20"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-accent" />
              ) : (
                <Play className="w-4 h-4 text-accent" />
              )}
            </Button>
            <div className="flex-1 text-sm text-muted-foreground">
              Enregistrement audio disponible
            </div>
          </div>
        )}

        {/* Summary */}
        {memory.summary && (
          <div className="mb-4 p-3 bg-accent/5 rounded-lg border-l-4 border-accent">
            <p className="text-sm text-foreground font-medium mb-1">Résumé :</p>
            <p className="text-sm text-muted-foreground">{memory.summary}</p>
          </div>
        )}

        {/* Transcript */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isExpanded ? memory.transcript : truncatedTranscript}
          </p>
          {memory.transcript.length > 150 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 h-auto p-0 text-accent hover:text-accent/80"
            >
              {isExpanded ? 'Voir moins' : 'Voir plus'}
            </Button>
          )}
        </div>

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {memory.tags.map((tag, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-xs bg-accent/10 text-accent border-accent/20"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};