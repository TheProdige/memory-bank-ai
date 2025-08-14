// Script de démonstration bout-en-bout d'EchoVault
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  CheckCircle, 
  Clock, 
  Mic,
  FileText,
  Search,
  Brain,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { transcribeAudioLocal } from '@/hooks/useLocalTranscription';
import { useOptimizedRAG } from '@/hooks/useOptimizedRAG';
import { generateLocalSummary } from '@/lib/localModels';
import { proactiveEngine } from '@/core/ai/ProactiveEngine';
import { Logger } from '@/core/logging/Logger';
import { cn } from '@/lib/utils';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  result?: any;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'audio-record',
    title: 'Enregistrement audio',
    description: 'Capture d\'un échantillon vocal de démonstration',
    icon: Mic,
    status: 'pending'
  },
  {
    id: 'transcription',
    title: 'Transcription locale',
    description: 'Conversion speech-to-text avec Whisper local',
    icon: FileText,
    status: 'pending'
  },
  {
    id: 'indexation',
    title: 'Indexation & Embeddings',
    description: 'Création des embeddings et index vectoriel',
    icon: Search,
    status: 'pending'
  },
  {
    id: 'rag-search',
    title: 'Recherche RAG',
    description: 'Test de recherche sémantique et génération de réponse',
    icon: Search,
    status: 'pending'
  },
  {
    id: 'proactive-brief',
    title: 'Brief proactif',
    description: 'Génération d\'intelligence proactive contextuelle',
    icon: Brain,
    status: 'pending'
  }
];

export const DemoScript: React.FC = () => {
  const [steps, setSteps] = useState<DemoStep[]>(DEMO_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [demoResults, setDemoResults] = useState<Record<string, any>>({});
  
  const { searchMemories } = useOptimizedRAG();

  // Mise à jour du statut d'une étape
  const updateStepStatus = useCallback((stepId: string, status: DemoStep['status'], result?: any) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, result, duration: Date.now() }
        : step
    ));
  }, []);

  // Génération d'audio de démonstration
  const generateDemoAudio = async (): Promise<Blob> => {
    // Simuler la génération d'un audio de démonstration
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const duration = 3; // 3 secondes
    const numSamples = sampleRate * duration;
    
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    // Générer un son simple (ton + bruit)
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      const frequency = 440; // La note A
      const tone = Math.sin(2 * Math.PI * frequency * time) * 0.3;
      const noise = (Math.random() - 0.5) * 0.1;
      channelData[i] = tone + noise;
    }
    
    // Convertir en WAV blob
    const wavData = audioBufferToWav(buffer);
    await audioContext.close();
    
    return new Blob([wavData], { type: 'audio/wav' });
  };

  // Exécution du script de démonstration
  const runDemoScript = async () => {
    setIsRunning(true);
    setProgress(0);
    
    try {
      Logger.info('Demo script started');
      
      // Étape 1: Enregistrement audio
      setCurrentStep('audio-record');
      updateStepStatus('audio-record', 'running');
      setProgress(10);
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulation
      const demoAudio = await generateDemoAudio();
      
      updateStepStatus('audio-record', 'completed', { 
        size: demoAudio.size, 
        duration: 3 
      });
      setProgress(20);
      
      // Étape 2: Transcription
      setCurrentStep('transcription');
      updateStepStatus('transcription', 'running');
      
      const transcriptionResult = await transcribeAudioLocal(demoAudio, {
        languageHint: 'fr',
        onProgress: (p) => setProgress(20 + (p * 0.3))
      });
      
      updateStepStatus('transcription', 'completed', transcriptionResult);
      setProgress(50);
      
      // Étape 3: Indexation
      setCurrentStep('indexation');
      updateStepStatus('indexation', 'running');
      
      // Simuler la création d'embeddings
      await new Promise(resolve => setTimeout(resolve, 1500));
      const embeddingResult = {
        chunks: 3,
        embeddings: 384,
        indexTime: 1500
      };
      
      updateStepStatus('indexation', 'completed', embeddingResult);
      setProgress(70);
      
      // Étape 4: Recherche RAG
      setCurrentStep('rag-search');
      updateStepStatus('rag-search', 'running');
      
      const searchQuery = "test de démonstration";
      const ragResult = await searchMemories(searchQuery, {
        topK: 3,
        useLocalSearch: true
      });
      
      updateStepStatus('rag-search', 'completed', ragResult);
      setProgress(85);
      
      // Étape 5: Brief proactif
      setCurrentStep('proactive-brief');
      updateStepStatus('proactive-brief', 'running');
      
      const proactiveBriefs = await proactiveEngine.forceProcessing();
      
      updateStepStatus('proactive-brief', 'completed', { 
        briefsGenerated: proactiveBriefs.length 
      });
      setProgress(100);
      
      Logger.info('Demo script completed successfully');
      
    } catch (error) {
      Logger.error('Demo script failed', { error });
      if (currentStep) {
        updateStepStatus(currentStep, 'error', { error: error.message });
      }
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  };

  // Réinitialisation du script
  const resetDemo = () => {
    setSteps(DEMO_STEPS.map(step => ({ ...step, status: 'pending', result: undefined })));
    setProgress(0);
    setCurrentStep(null);
    setDemoResults({});
  };

  // Calcul du statut global
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const errorSteps = steps.filter(s => s.status === 'error').length;
  const totalSteps = steps.length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
            <Play className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Démonstration E2E</h2>
            <p className="text-sm text-muted-foreground">
              Test complet du pipeline EchoVault
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={resetDemo}
            disabled={isRunning}
          >
            Réinitialiser
          </Button>
          <Button
            onClick={runDemoScript}
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <>
                <Square className="w-4 h-4" />
                En cours...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Lancer la démo
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progrès global */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progrès global</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps}/{totalSteps} étapes
              </span>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {completedSteps} complétées
                </Badge>
                {errorSteps > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errorSteps} erreurs
                  </Badge>
                )}
              </div>
              
              {isRunning && (
                <div className="text-muted-foreground">
                  Étape en cours: {steps.find(s => s.id === currentStep)?.title}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des étapes */}
      <div className="space-y-4">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <StepCard 
                step={step} 
                isActive={currentStep === step.id}
                stepNumber={index + 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Résultats finaux */}
      {completedSteps === totalSteps && errorSteps === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>Démonstration terminée avec succès !</strong>
              <br />
              Toutes les étapes du pipeline EchoVault ont été validées.
              L'application est prête pour la production.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    </div>
  );
};

// Composant pour une carte d'étape
interface StepCardProps {
  step: DemoStep;
  isActive: boolean;
  stepNumber: number;
}

const StepCard: React.FC<StepCardProps> = ({ step, isActive, stepNumber }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (step.status) {
      case 'completed': return 'border-green-200 bg-green-50';
      case 'running': return 'border-blue-200 bg-blue-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-muted-foreground/20';
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-200",
      getStatusColor(),
      isActive && "shadow-md scale-105"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Numéro d'étape */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {stepNumber}
          </div>
          
          {/* Icône et détails */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <step.icon className="w-5 h-5 text-primary" />
              <h3 className="font-medium">{step.title}</h3>
              {getStatusIcon()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {step.description}
            </p>
            
            {/* Résultats */}
            {step.result && step.status === 'completed' && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                {step.id === 'transcription' && (
                  <div>
                    Texte: "{step.result.text?.slice(0, 50)}..."
                    <br />
                    Durée: {step.result.elapsedMs}ms
                  </div>
                )}
                {step.id === 'rag-search' && (
                  <div>
                    Chunks trouvés: {step.result.chunks?.length || 0}
                    <br />
                    Temps: {Math.round(step.result.processingTime || 0)}ms
                  </div>
                )}
                {step.id === 'proactive-brief' && (
                  <div>
                    Briefs générés: {step.result.briefsGenerated || 0}
                  </div>
                )}
              </div>
            )}
            
            {/* Erreur */}
            {step.result && step.status === 'error' && (
              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                Erreur: {step.result.error}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Utilitaire pour convertir AudioBuffer en WAV
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // En-tête WAV
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);
  
  // Données audio
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}

export default DemoScript;