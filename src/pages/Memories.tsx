import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/SearchBar";
import { MemoryCard } from "@/components/MemoryCard";
import { UsageIndicator } from "@/components/UsageIndicator";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { useMemories } from "@/hooks/useMemories";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ArrowLeft, 
  Grid3X3, 
  List, 
  Download, 
  Upload,
  Brain,
  Search,
  Calendar,
  Tag
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Memories = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    memories, 
    loading, 
    searchQuery, 
    setSearchQuery, 
    deleteMemory,
    addMemory 
  } = useMemories();
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterTag, setFilterTag] = useState<string>('');
  const [audioElements, setAudioElements] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [playingMemory, setPlayingMemory] = useState<string | null>(null);

  // Récupérer tous les tags uniques
  const allTags = Array.from(
    new Set(
      memories
        .flatMap(memory => memory.tags || [])
        .filter(Boolean)
    )
  );

  // Filtrer par tag si sélectionné
  const filteredMemories = filterTag 
    ? memories.filter(memory => memory.tags?.includes(filterTag))
    : memories;

  const handlePlayAudio = (memory: any) => {
    if (!memory.audio_url) return;

    // Arrêter tous les autres audios
    Object.values(audioElements).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });

    if (playingMemory === memory.id) {
      setPlayingMemory(null);
      return;
    }

    // Créer ou récupérer l'élément audio
    let audio = audioElements[memory.id];
    if (!audio) {
      audio = new Audio(memory.audio_url);
      audio.addEventListener('ended', () => setPlayingMemory(null));
      setAudioElements(prev => ({ ...prev, [memory.id]: audio }));
    }

    audio.play();
    setPlayingMemory(memory.id);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemory(memoryId);
      toast.success("Mémoire supprimée avec succès");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(memories, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `echovault-memories-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Données exportées avec succès");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de vos mémoires...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/dashboard")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Mes Mémoires</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredMemories.length} mémoire{filteredMemories.length > 1 ? 's' : ''} 
                  {filterTag && ` avec le tag "${filterTag}"`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <UsageIndicator variant="compact" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                disabled={memories.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="max-w-2xl"
          />
          
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={!filterTag ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilterTag('')}
                  >
                    Tous
                  </Badge>
                  {allTags.slice(0, 8).map(tag => (
                    <Badge
                      key={tag}
                      variant={filterTag === tag ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Empty State */}
        {filteredMemories.length === 0 && (
          <Card className="shadow-elegant">
            <CardContent className="p-12 text-center">
              {searchQuery || filterTag ? (
                <>
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun résultat</h3>
                  <p className="text-muted-foreground mb-4">
                    Aucune mémoire ne correspond à vos critères de recherche.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterTag('');
                    }}
                  >
                    Effacer les filtres
                  </Button>
                </>
              ) : (
                <>
                  <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune mémoire pour le moment</h3>
                  <p className="text-muted-foreground mb-4">
                    Commencez à enregistrer vos pensées et idées importantes.
                  </p>
                  <Button onClick={() => navigate('/dashboard')}>
                    Créer ma première mémoire
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Memories Grid/List */}
        {filteredMemories.length > 0 && (
          <div className={
            viewMode === 'grid' 
              ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
              : "space-y-4"
          }>
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onPlay={() => handlePlayAudio(memory)}
                onDelete={() => handleDeleteMemory(memory.id)}
                isPlaying={playingMemory === memory.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Record Button */}
      <FloatingRecordButton onMemoryCreated={addMemory} />
    </div>
  );
};

export default Memories;