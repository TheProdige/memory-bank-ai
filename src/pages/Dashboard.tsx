import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Vault, 
  Plus, 
  Mic, 
  Search, 
  Settings, 
  LogOut,
  User,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [isRecording, setIsRecording] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Déconnexion réussie");
    } catch (error) {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    // TODO: Implement audio recording
    toast.info("Fonctionnalité d'enregistrement à venir...");
  };

  const stopRecording = () => {
    setIsRecording(false);
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
            <Button variant="outline" size="sm">
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
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Souvenirs enregistrés</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  +0 ce mois-ci
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temps d'écoute</CardTitle>
                <Mic className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0h 0m</div>
                <p className="text-xs text-muted-foreground">
                  Total enregistré
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
                  10/10 souvenirs restants
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Action Section */}
          <div className="max-w-2xl mx-auto w-full">
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
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`h-16 w-16 rounded-full ${
                      isRecording 
                        ? "bg-destructive hover:bg-destructive/90" 
                        : "bg-accent hover:bg-accent/90"
                    } shadow-gold-glow`}
                  >
                    <Mic className={`w-8 h-8 ${isRecording ? "animate-pulse" : ""}`} />
                  </Button>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {isRecording ? "Enregistrement en cours... Cliquez pour arrêter" : "Cliquez pour commencer l'enregistrement"}
                  </p>
                </div>

                {/* Alternative Options */}
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-12">
                    <Plus className="w-4 h-4 mr-2" />
                    Importer un fichier
                  </Button>
                  <Button variant="outline" className="h-12">
                    <Search className="w-4 h-4 mr-2" />
                    Rechercher
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Memories */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Souvenirs récents</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;