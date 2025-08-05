import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  Brain, 
  Search, 
  Shield, 
  Calendar, 
  Sparkles,
  Check,
  ArrowRight,
  Play,
  Vault
} from "lucide-react";

const Index = () => {
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
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-sm font-medium hover:text-accent transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium hover:text-accent transition-colors">Pricing</a>
            <a href="#faq" className="text-sm font-medium hover:text-accent transition-colors">FAQ</a>
            <Button size="sm">Get Started</Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 bg-accent/10 text-accent border-accent/20">
              The Future of Personal Memory
            </Badge>
            <h1 className="text-4xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
              Save your mind.
              <br />
              <span className="text-accent">Not just your money.</span>
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              EchoVault AI est la première banque de souvenirs et de pensées.
              Dépose tes idées. Reprends tes souvenirs. Ne perds plus jamais une pensée.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-gold-glow" asChild>
                <a href="/auth">
                  Créer mon compte gratuitement
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                <Play className="mr-2 w-5 h-5" />
                Voir la démo
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-primary-foreground/60">
              <div className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-accent" />
                Enregistre tes idées
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-accent" />
                Ne perds plus jamais une discussion
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-accent" />
                Retrouve tout ce que tu dis, quand tu veux
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Une banque mentale révolutionnaire
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              EchoVault transforme tes pensées éphémères en souvenirs durables avec l'intelligence artificielle.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">🎙 Enregistre tes pensées</h3>
                <p className="text-muted-foreground">
                  Capture tes idées en temps réel avec un simple enregistrement vocal. Plus besoin de noter, parle simplement.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">✍️ Transcription et résumé automatiques</h3>
                <p className="text-muted-foreground">
                  L'IA transforme tes enregistrements en texte structuré et génère des résumés intelligents.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">🧠 Mémoire intelligente consultable</h3>
                <p className="text-muted-foreground">
                  Retrouve n'importe quelle information avec un chat IA qui comprend le contexte de tes souvenirs.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">🔒 Données chiffrées et sécurisées</h3>
                <p className="text-muted-foreground">
                  Tes pensées restent privées grâce à un chiffrement de niveau bancaire et des serveurs sécurisés.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">📅 Historique illimité</h3>
                <p className="text-muted-foreground">
                  Accède à toutes tes pensées, même celles d'il y a des années. Ta mémoire n'a plus de limite.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant hover:shadow-gold-glow transition-all duration-300 border-border/50">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">🔍 Recherche sémantique</h3>
                <p className="text-muted-foreground">
                  Trouve des informations par concept, pas seulement par mots-clés. L'IA comprend le sens de tes recherches.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Case Example */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-primary text-primary-foreground shadow-elegant">
              <CardContent className="p-8 lg:p-12">
                <div className="text-center mb-8">
                  <h2 className="text-2xl lg:text-3xl font-bold mb-4">
                    Exemple concret d'utilisation
                  </h2>
                </div>
                <blockquote className="text-lg lg:text-xl italic mb-6 text-center">
                  "En juin, j'ai eu une idée géniale de business dans ma voiture.
                  Grâce à EchoVault, j'ai retrouvé exactement ce que j'ai dit, 2 mois plus tard."
                </blockquote>
                <div className="text-center">
                  <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">
                    Sarah, Entrepreneure
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Tarification simple et transparente
            </h2>
            <p className="text-lg text-muted-foreground">
              Commence gratuitement, upgrade quand tu es prêt
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="shadow-elegant border-border/50">
              <CardContent className="p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Gratuit</h3>
                  <div className="text-4xl font-bold mb-4">0€</div>
                  <p className="text-muted-foreground mb-6">Pour découvrir EchoVault</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    10 souvenirs stockés
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Transcription automatique
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Recherche basique
                  </li>
                </ul>
                <Button className="w-full" variant="outline">
                  Commencer gratuitement
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-gold-glow border-accent/20 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-accent text-accent-foreground">Populaire</Badge>
              </div>
              <CardContent className="p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Pro</h3>
                  <div className="text-4xl font-bold mb-4">5€<span className="text-lg font-normal">/mois</span></div>
                  <p className="text-muted-foreground mb-6">Pour une mémoire illimitée</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Souvenirs illimités
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Chat IA avancé
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Recherche sémantique
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Export des données
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    Support prioritaire
                  </li>
                </ul>
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  Upgrader vers Pro
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Questions fréquentes
            </h2>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="shadow-elegant border-border/50">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Est-ce que mes enregistrements sont privés ?</h3>
                <p className="text-muted-foreground">
                  Absolument. Tes données sont chiffrées de bout en bout avec un standard de sécurité bancaire. 
                  Nous ne pouvons pas accéder à tes enregistrements ni les écouter.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant border-border/50">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Est-ce que je peux tout exporter ?</h3>
                <p className="text-muted-foreground">
                  Oui, tu peux exporter toutes tes données à tout moment. Tes souvenirs t'appartiennent entièrement.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant border-border/50">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Est-ce que je peux l'utiliser hors ligne ?</h3>
                <p className="text-muted-foreground">
                  Cette fonctionnalité arrive bientôt ! Pour l'instant, une connexion internet est nécessaire 
                  pour la transcription et la recherche IA.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant border-border/50">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Dans quelles langues ça fonctionne ?</h3>
                <p className="text-muted-foreground">
                  EchoVault supporte plus de 50 langues pour la transcription, incluant le français, l'anglais, 
                  l'espagnol, l'allemand et bien d'autres.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-hero">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
              Prêt à transformer ta mémoire ?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8">
              Rejoins les milliers d'utilisateurs qui ont déjà révolutionné leur façon de penser et de se souvenir.
            </p>
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-gold-glow">
              Créer mon compte gratuitement
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-gold">
                <Vault className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold">EchoVault AI</span>
            </div>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Politique de confidentialité</a>
              <a href="#" className="hover:text-foreground transition-colors">Conditions d'utilisation</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground mt-8">
            © 2024 EchoVault AI. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
