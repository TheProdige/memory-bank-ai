import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileManager } from "@/components/FileManager";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { 
  ArrowLeft,
  FileText,
  Upload,
  Shield,
  HardDrive
} from "lucide-react";

const Files = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <h1 className="text-xl font-bold">Gestionnaire de fichiers</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              Configuration
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="grid gap-8">
          {/* Introduction */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-accent" />
                Gestion de fichiers EchoVault
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-medium mb-2">Local-first et sécurisé</h3>
                  <p className="text-sm text-muted-foreground">
                    Traitement local par défaut avec chiffrement AES-256
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-medium mb-2">Extraction intelligente</h3>
                  <p className="text-sm text-muted-foreground">
                    Texte extrait automatiquement avec embeddings locaux
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                    <HardDrive className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-medium mb-2">Optimisation des coûts</h3>
                  <p className="text-sm text-muted-foreground">
                    Batching, cache et quotas pour minimiser les coûts API
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Manager */}
          <FileManager 
            onFileSelect={(fileId) => {
              console.log('File selected:', fileId);
              // Could navigate to file details or show preview
            }}
          />

          {/* Metrics Dashboard */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Métriques de stockage et traitement</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsDashboard />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Files;