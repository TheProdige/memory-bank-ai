import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "./FileUpload";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { 
  Mic, 
  Square, 
  Upload, 
  Loader2,
  Play,
  Pause,
  Volume2,
  Tag,
  Heart,
  X,
  Save,
  Zap,
  AlertTriangle,
  CheckCircle,
  Timer
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressText } from "@/lib/promptPreprocessor";
import { Switch } from "@/components/ui/switch";
import { transcribeAudioLocal } from "@/hooks/useLocalTranscription";

interface AudioRecorderProps {
  onMemoryCreated?: (memory: any) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onMemoryCreated }) => {
  const { canCreateMemory, dailyUsed, dailyLimit, incrementUsage } = useUsageLimits();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingVolume, setRecordingVolume] = useState(0);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState("");
  
  // Audio states
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Content states
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [isAutoTitle, setIsAutoTitle] = useState(true);

  // Transcription options
  const [offlineMode, setOfflineMode] = useState(true);
  
  // Local storage fallback
  const [localBackup, setLocalBackup] = useState<any>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const volumeAnalyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, sampleRate: 16000, noiseSuppression: true, echoCancellation: true }
      });
      streamRef.current = stream;

      // WebAudio setup for simple VAD + volume meter
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      volumeAnalyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        // Cleanup timers and audio
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current as any); recordingTimerRef.current = null; }
        audioCtx.close();
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      toast.success("Enregistrement démarré");

      // Recording timer and VAD loop
      let silenceMs = 0;
      const checkInterval = 200; // ms
      const maxDurationMs = 45000; // 45s
      const startedAt = performance.now();

      recordingTimerRef.current = setInterval(() => {
        // Update elapsed time
        const elapsed = Math.floor((performance.now() - startedAt) / 1000);
        setRecordingTime(elapsed);
        // VAD energy check
        if (volumeAnalyserRef.current) {
          volumeAnalyserRef.current.getByteTimeDomainData(dataArray);
          // Compute RMS
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128; // center to 0
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          setRecordingVolume(rms);
          const isSilent = rms < 0.015; // threshold ~ -36dB
          silenceMs = isSilent ? silenceMs + checkInterval : 0;
          if (silenceMs >= 1500 && elapsed > 1) {
            // Auto-stop on 1.5s silence after at least 1s of speech
            stopRecording();
          }
        }
        // Hard stop at 45s
        if (performance.now() - startedAt >= maxDurationMs) {
          stopRecording();
        }
      }, checkInterval) as any;
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Enregistrement terminé");
    }
  };

  const { transcribeAudio: hybridTranscribe } = useHybridProcessing();

  const transcribeAudio = async () => {
    if (!audioURL) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressStep("Analyse de complexité...");
    
    try {
      const response = await fetch(audioURL);
      const blob = await response.blob();

      // Utiliser le système hybride
      const result = await hybridTranscribe(blob, {
        languageHint: 'auto',
        userTier: 'free', // TODO: récupérer du profil utilisateur
        enableFallback: !offlineMode,
        forceModel: offlineMode ? 'local' : undefined
      });

      setTranscript(result.result.text);
      toast.success(`Transcription terminée (${result.model}${result.cost > 0 ? `, $${result.cost.toFixed(4)}` : ', gratuit'})`);
      
      // Log pour optimisation
      console.log('Transcription hybride:', {
        model: result.model,
        complexity: result.complexity.score,
        cost: result.cost,
        processingTime: result.processingTime
      });

    } catch (error) {
      console.error('Transcription error:', error);
      toast.error("Erreur lors de la transcription");
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressStep("");
    }
  };

  const processMemory = async () => {
    if (!transcript) {
      toast.error("Aucune transcription disponible");
      return;
    }

    setIsProcessing(true);

    try {
      const compressed = compressText(transcript, 4000);

      // Local cache: avoid duplicate processing
      const encoder = new TextEncoder();
      const hashInput = encoder.encode(`${compressed}|${title || ''}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashInput);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const cacheKey = `pm:${hashHex}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days
          if (Date.now() - (parsed.savedAt || 0) < ttlMs && parsed.memory) {
            toast.success("Souvenir récupéré du cache local");
            onMemoryCreated?.(parsed.memory);
            resetRecorder();
            return;
          }
        } catch {}
      }

      const { data, error } = await supabase.functions.invoke('process-memory', {
        body: { transcript: compressed, title }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        toast.success("Souvenir créé avec succès!");
        onMemoryCreated?.(data.memory);
        try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), memory: data.memory })); } catch {}
        resetRecorder();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error("Erreur lors du traitement");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRecorder = () => {
    setAudioURL(null);
    setTranscript("");
    setTitle("");
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    audioChunksRef.current = [];
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Enregistrer un souvenir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Options */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Mode hors-ligne</p>
              <p className="text-xs text-muted-foreground">Transcription locale (aucune requête externe)</p>
            </div>
            <Switch checked={offlineMode} onCheckedChange={setOfflineMode} aria-label="Basculer le mode hors-ligne" />
          </div>

          {/* Recording Controls */}
          <div className="text-center space-y-4">
            {!audioURL ? (
              <Button
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                className={`h-16 w-16 rounded-full ${
                  isRecording 
                    ? "bg-destructive hover:bg-destructive/90" 
                    : "bg-accent hover:bg-accent/90"
                } shadow-gold-glow`}
                disabled={isProcessing}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 animate-pulse" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            ) : (
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={togglePlayback}
                  className="flex items-center gap-2"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "Pause" : "Écouter"}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetRecorder}
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4 mr-2" />
                  Recommencer
                </Button>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              {isRecording 
                ? "Enregistrement en cours... Cliquez pour arrêter"
                : audioURL 
                ? "Enregistrement prêt pour transcription"
                : "Cliquez pour commencer l'enregistrement"
              }
            </p>
          </div>

          {/* Audio Player */}
          {audioURL && (
            <div className="space-y-2">
              <audio
                ref={audioRef}
                src={audioURL}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDuration(audioRef.current.duration);
                  }
                }}
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="w-4 h-4" />
                <span>
                  {Math.floor(currentTime)}s / {Math.floor(duration)}s
                </span>
              </div>
            </div>
          )}

          {/* Transcription */}
          {audioURL && !transcript && (
            <div className="text-center">
              <Button 
                onClick={transcribeAudio}
                disabled={isProcessing}
                className="bg-accent hover:bg-accent/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Transcription...
                  </>
                ) : (
                  "Transcrire l'audio"
                )}
              </Button>
            </div>
          )}

          {/* Transcript Display */}
          {transcript && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titre (optionnel)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Donnez un titre à ce souvenir..."
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="transcript">Transcription</Label>
                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="La transcription apparaîtra ici..."
                  className="mt-1 min-h-[120px]"
                />
              </div>

              <Button 
                onClick={processMemory}
                disabled={isProcessing || !transcript}
                className="w-full bg-accent hover:bg-accent/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création du souvenir...
                  </>
                ) : (
                  "Créer le souvenir"
                )}
              </Button>
            </div>
          )}

          {/* Upload Alternative */}
          <div className="border-t pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Ou importez un fichier audio existant
              </p>
              <Button variant="outline" disabled>
                <Upload className="w-4 h-4 mr-2" />
                Importer un fichier (bientôt disponible)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioRecorder;