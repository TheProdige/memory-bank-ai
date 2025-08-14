import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AudioRecorder from "@/components/AudioRecorder";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { UsageIndicator } from "@/components/UsageIndicator";
import { useMemories } from "@/hooks/useMemories";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { 
  Vault, 
  Plus, 
  Mic, 
  Search, 
  Settings, 
  LogOut,
  User,
  Calendar,
  Clock,
  Tag,
  Heart,
  ArrowRight,
  Brain,
  FileText
} from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { memories, loading, addMemory } = useMemories();
  const { canCreateMemory, dailyUsed, dailyLimit, memoriesCount } = useUsageLimits();
  const [showRecorder, setShowRecorder] = useState(false);

  const handleMemoryCreated = (newMemory: any) => {
    addMemory(newMemory);
    setShowRecorder(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Déconnexion réussie");
    } catch (error) {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const startRecording = () => {
    if (!canCreateMemory) {
      toast.error(`Limite quotidienne atteinte (${dailyUsed}/${dailyLimit}). Revenez demain ou passez Pro !`);
      return;
    }
    setShowRecorder(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-gold">
              <Vault className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold">EchoVault AI</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {user?.user_metadata?.display_name || user?.email}
              </span>
            </div>
            <UsageIndicator variant="compact" />
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Paramètres
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="grid gap-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">
              Bienvenue dans votre banque de souvenirs
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Commencez à enregistrer vos pensées et idées. Votre mémoire personnelle commence ici.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total souvenirs</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{memoriesCount}</div>
                <p className="text-xs text-muted-foreground">
                  Toutes vos mémoires
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usage quotidien</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyUsed}/{dailyLimit}</div>
                <p className="text-xs text-muted-foreground">
                  Enregistrements aujourd'hui
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ce mois-ci</CardTitle>
                <Mic className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {memories.filter(m => new Date(m.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Nouveaux souvenirs
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plan actuel</CardTitle>
                <Vault className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Gratuit</div>
                <p className="text-xs text-muted-foreground">
                  {dailyLimit - dailyUsed} crédits restants
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Action Section */}
          <div className="max-w-2xl mx-auto w-full">
            {showRecorder ? (
              <AudioRecorder onMemoryCreated={handleMemoryCreated} />
            ) : (
              <Card className="shadow-elegant border-accent/20">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Créer un nouveau souvenir</CardTitle>
                  <p className="text-muted-foreground">
                    Enregistrez vos pensées, idées ou conversations importantes
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Recording Button */}
                  <div className="text-center">
                    <Button
                      size="lg"
                      onClick={startRecording}
                      disabled={memories.length >= 10}
                      className="h-16 w-16 rounded-full bg-accent hover:bg-accent/90 shadow-gold-glow"
                    >
                      <Mic className="w-8 h-8" />
                    </Button>
                    <p className="mt-4 text-sm text-muted-foreground">
                      {memories.length >= 10 
                        ? "Limite gratuite atteinte - Passez au plan Pro" 
                        : "Cliquez pour commencer l'enregistrement"
                      }
                    </p>
                  </div>

                  {/* Alternative Options */}
                  <div className="grid grid-cols-3 gap-4">
                    <Button variant="outline" className="h-12" onClick={() => navigate('/memories')}>
                      <Search className="w-4 h-4 mr-2" />
                      Mes souvenirs
                    </Button>
                    <Button variant="outline" className="h-12" onClick={() => navigate('/files')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Mes fichiers
                    </Button>
                    <Button variant="outline" className="h-12" onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Paramètres
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Memories */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Souvenirs récents</h2>
              {memories.length > 0 && (
                <Button variant="outline" onClick={() => navigate('/memories')}>
                  Voir tous
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
            {loading ? (
              <Card className="shadow-elegant">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Chargement...</p>
                </CardContent>
              </Card>
            ) : memories.length === 0 ? (
              <Card className="shadow-elegant">
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Mic className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Aucun souvenir encore</h3>
                      <p className="text-muted-foreground">
                        Commencez par enregistrer votre première pensée !
                      </p>
                    </div>
                    <Button 
                      onClick={startRecording}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Créer mon premier souvenir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {memories.slice(0, 3).map((memory) => (
                  <Card key={memory.id} className="shadow-elegant hover:shadow-gold-glow transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-lg">{memory.title}</h3>
                        <div className="flex items-center gap-2">
                          {memory.emotion && (
                            <Badge variant="secondary" className="text-xs">
                              <Heart className="w-3 h-3 mr-1" />
                              {memory.emotion}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(memory.created_at).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-muted-foreground mb-3 line-clamp-2">
                        {memory.summary || memory.transcript}
                      </p>
                      
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {memory.tags.slice(0, 3).map((tag: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {memory.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{memory.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>{new Date(memory.created_at).toLocaleString()}</span>
                        <Button variant="outline" size="sm" onClick={() => navigate('/memories')}>
                          Voir détails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Record Button */}
      <FloatingRecordButton onMemoryCreated={handleMemoryCreated} />
    </div>
  );
};

export default Dashboard;