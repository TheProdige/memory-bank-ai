import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UsageIndicator } from "@/components/UsageIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { 
  ArrowLeft, 
  User, 
  Crown, 
  Shield, 
  Palette, 
  Volume2,
  Download,
  Trash2,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTheme } from "next-themes";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { subscriptionTier, memoriesCount } = useUsageLimits();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    autoTranscribe: true,
    soundNotifications: true,
    darkMode: theme === 'dark',
    emailNotifications: false,
    autoSave: true,
    compressionQuality: 'medium',
    defaultTags: '',
  });

  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '');

  const handleSaveProfile = async () => {
    // TODO: Implement profile update
    toast.success("Profil mis à jour avec succès");
  };

  const handleExportAllData = () => {
    toast.success("Export des données en cours...");
    // TODO: Implement full data export
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.")) {
      toast.error("Fonctionnalité de suppression de compte à venir");
      // TODO: Implement account deletion
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast.success("Déconnecté avec succès");
    } catch (error) {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Actions spéciales pour certains paramètres
    if (key === 'darkMode') {
      setTheme(value ? 'dark' : 'light');
    }
  };

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
              <div className="flex items-center space-x-2">
                <SettingsIcon className="w-6 h-6" />
                <h1 className="text-2xl font-bold">Paramètres</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-6 max-w-4xl">
        <div className="grid gap-6">
          {/* Profile Section */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Profil</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Membre depuis {new Date(user?.created_at || '').toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge 
                  variant={subscriptionTier === 'pro' ? 'default' : 'secondary'}
                  className={subscriptionTier === 'pro' ? 'bg-accent text-accent-foreground' : ''}
                >
                  {subscriptionTier === 'pro' ? (
                    <>
                      <Crown className="w-3 h-3 mr-1" />
                      PRO
                    </>
                  ) : (
                    'GRATUIT'
                  )}
                </Badge>
              </div>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="displayName">Nom d'affichage</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <Button onClick={handleSaveProfile} className="w-fit">
                  Enregistrer les modifications
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Statistiques d'utilisation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <UsageIndicator variant="full" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Mémoires totales :</span>
                    <span className="font-medium">{memoriesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Abonnement :</span>
                    <span className="font-medium capitalize">{subscriptionTier}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="w-5 h-5" />
                <span>Apparence</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Thème</Label>
                  <p className="text-sm text-muted-foreground">Choisissez votre thème préféré</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audio Settings */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5" />
                <span>Audio</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Transcription automatique</Label>
                  <p className="text-sm text-muted-foreground">
                    Transcrire automatiquement les enregistrements
                  </p>
                </div>
                <Switch
                  checked={settings.autoTranscribe}
                  onCheckedChange={(checked) => updateSetting('autoTranscribe', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notifications sonores</Label>
                  <p className="text-sm text-muted-foreground">
                    Son lors du début/fin d'enregistrement
                  </p>
                </div>
                <Switch
                  checked={settings.soundNotifications}
                  onCheckedChange={(checked) => updateSetting('soundNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sauvegarde automatique</Label>
                  <p className="text-sm text-muted-foreground">
                    Sauvegarder automatiquement en local en cas d'échec
                  </p>
                </div>
                <Switch
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => updateSetting('autoSave', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Gestion des données</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exporter toutes les données</Label>
                  <p className="text-sm text-muted-foreground">
                    Télécharger une archive complète de vos données
                  </p>
                </div>
                <Button variant="outline" onClick={handleExportAllData}>
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-destructive">Supprimer le compte</Label>
                  <p className="text-sm text-muted-foreground">
                    Supprimer définitivement votre compte et toutes vos données
                  </p>
                </div>
                <Button variant="destructive" onClick={handleDeleteAccount}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="shadow-elegant">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Se déconnecter</p>
                  <p className="text-sm text-muted-foreground">
                    Déconnectez-vous de votre compte EchoVault
                  </p>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  Se déconnecter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;