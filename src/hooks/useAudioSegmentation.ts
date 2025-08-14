// Hook pour la segmentation audio avec détection VAD
import { useState, useCallback } from 'react';
import { Logger } from '@/core/logging/Logger';

export interface AudioSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  hasVoice: boolean;
  blob: Blob;
  confidence: number;
}

export interface SegmentationOptions {
  segmentDuration: number; // Durée cible par segment (secondes)
  overlapDuration: number; // Chevauchement entre segments (secondes)
  minSegmentDuration: number; // Durée minimale d'un segment
  maxSegmentDuration: number; // Durée maximale d'un segment
  vadThreshold: number; // Seuil pour la détection de voix (0-1)
  enableSilenceRemoval: boolean;
}

const DEFAULT_OPTIONS: SegmentationOptions = {
  segmentDuration: 45, // 45 secondes par segment
  overlapDuration: 5,  // 5 secondes de chevauchement
  minSegmentDuration: 10,
  maxSegmentDuration: 60,
  vadThreshold: 0.3,
  enableSilenceRemoval: true
};

export const useAudioSegmentation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Segmentation principale
  const segmentAudio = useCallback(async (
    audioBlob: Blob,
    options: Partial<SegmentationOptions> = {},
    onProgress?: (progress: number, step: string) => void
  ): Promise<AudioSegment[]> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    setIsProcessing(true);
    setProgress(0);

    try {
      Logger.info('Starting audio segmentation', { 
        size: audioBlob.size,
        options: opts 
      });

      onProgress?.(10, 'Chargement de l\'audio');

      // Convertir le blob en AudioBuffer
      const audioBuffer = await audioBlob2Buffer(audioBlob);
      onProgress?.(20, 'Analyse audio');

      // Détection d'activité vocale (VAD)
      const voiceActivity = await detectVoiceActivity(audioBuffer, opts.vadThreshold);
      onProgress?.(40, 'Détection de la voix');

      // Segmentation basée sur VAD et durée cible
      const segments = await createSegments(audioBuffer, voiceActivity, opts);
      onProgress?.(70, 'Création des segments');

      // Conversion des segments en blobs
      const segmentBlobs = await segments2Blobs(audioBuffer, segments);
      onProgress?.(90, 'Finalisation');

      const result = segments.map((segment, index) => ({
        id: `segment_${index}`,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.endTime - segment.startTime,
        hasVoice: segment.hasVoice,
        blob: segmentBlobs[index],
        confidence: segment.confidence
      }));

      onProgress?.(100, 'Terminé');
      setProgress(100);

      Logger.info('Audio segmentation completed', { 
        segments: result.length,
        totalDuration: audioBuffer.duration 
      });

      return result;

    } catch (error) {
      Logger.error('Audio segmentation failed', { error });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    segmentAudio,
    isProcessing,
    progress
  };
};

// Conversion Blob vers AudioBuffer
async function audioBlob2Buffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }
}

// Détection d'activité vocale simple (VAD)
async function detectVoiceActivity(
  audioBuffer: AudioBuffer, 
  threshold: number
): Promise<Array<{ time: number; isVoice: boolean; energy: number }>> {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.1); // Fenêtre de 100ms
  const hopSize = Math.floor(windowSize / 2); // Chevauchement de 50%
  
  const activity: Array<{ time: number; isVoice: boolean; energy: number }> = [];
  
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    const window = channelData.slice(i, i + windowSize);
    
    // Calcul de l'énergie RMS
    const rms = Math.sqrt(
      window.reduce((sum, sample) => sum + sample * sample, 0) / window.length
    );
    
    // Calcul du taux de passage par zéro (ZCR)
    let zcr = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0) !== (window[j - 1] >= 0)) {
        zcr++;
      }
    }
    zcr /= window.length;
    
    // Score combiné énergie + ZCR
    const energyScore = Math.min(rms * 10, 1); // Normaliser l'énergie
    const zcrScore = Math.min(zcr * 2, 1); // Normaliser ZCR
    const combinedScore = (energyScore * 0.7) + (zcrScore * 0.3);
    
    const isVoice = combinedScore > threshold;
    const time = i / sampleRate;
    
    activity.push({
      time,
      isVoice,
      energy: combinedScore
    });
  }
  
  // Lissage des résultats pour éviter les oscillations
  return smoothVAD(activity);
}

// Lissage des résultats VAD
function smoothVAD(
  activity: Array<{ time: number; isVoice: boolean; energy: number }>
): Array<{ time: number; isVoice: boolean; energy: number }> {
  const smoothed = [...activity];
  const windowSize = 5; // Fenêtre de lissage
  
  for (let i = windowSize; i < smoothed.length - windowSize; i++) {
    const window = smoothed.slice(i - windowSize, i + windowSize + 1);
    const voiceCount = window.filter(item => item.isVoice).length;
    
    // Majorité vote
    smoothed[i].isVoice = voiceCount > windowSize;
  }
  
  return smoothed;
}

// Création des segments basée sur VAD et contraintes temporelles
async function createSegments(
  audioBuffer: AudioBuffer,
  voiceActivity: Array<{ time: number; isVoice: boolean; energy: number }>,
  options: SegmentationOptions
): Promise<Array<{ startTime: number; endTime: number; hasVoice: boolean; confidence: number }>> {
  const segments: Array<{ startTime: number; endTime: number; hasVoice: boolean; confidence: number }> = [];
  const duration = audioBuffer.duration;
  
  // Trouver les régions de voix continues
  const voiceRegions: Array<{ start: number; end: number; avgEnergy: number }> = [];
  let currentRegion: { start: number; avgEnergy: number; samples: number } | null = null;
  
  for (const activity of voiceActivity) {
    if (activity.isVoice) {
      if (!currentRegion) {
        currentRegion = { start: activity.time, avgEnergy: activity.energy, samples: 1 };
      } else {
        currentRegion.avgEnergy = 
          (currentRegion.avgEnergy * currentRegion.samples + activity.energy) / 
          (currentRegion.samples + 1);
        currentRegion.samples++;
      }
    } else {
      if (currentRegion) {
        voiceRegions.push({
          start: currentRegion.start,
          end: activity.time,
          avgEnergy: currentRegion.avgEnergy
        });
        currentRegion = null;
      }
    }
  }
  
  // Fermer la dernière région si nécessaire
  if (currentRegion) {
    voiceRegions.push({
      start: currentRegion.start,
      end: duration,
      avgEnergy: currentRegion.avgEnergy
    });
  }
  
  // Créer des segments en respectant les contraintes
  let currentTime = 0;
  
  while (currentTime < duration) {
    const targetEnd = currentTime + options.segmentDuration;
    let segmentEnd = Math.min(targetEnd, duration);
    
    // Chercher un point de coupe optimal (silence ou fin de phrase)
    const searchStart = Math.max(currentTime + options.minSegmentDuration, targetEnd - 10);
    const searchEnd = Math.min(targetEnd + 10, duration);
    
    const optimalCut = findOptimalCutPoint(voiceActivity, searchStart, searchEnd);
    if (optimalCut > 0) {
      segmentEnd = optimalCut;
    }
    
    // Vérifier si le segment contient de la voix
    const segmentVoiceRegions = voiceRegions.filter(region => 
      (region.start >= currentTime && region.start < segmentEnd) ||
      (region.end > currentTime && region.end <= segmentEnd) ||
      (region.start < currentTime && region.end > segmentEnd)
    );
    
    const hasVoice = segmentVoiceRegions.length > 0;
    const confidence = hasVoice 
      ? segmentVoiceRegions.reduce((sum, region) => sum + region.avgEnergy, 0) / segmentVoiceRegions.length
      : 0;
    
    // Éviter les segments trop courts sans voix
    if (segmentEnd - currentTime >= options.minSegmentDuration || hasVoice) {
      segments.push({
        startTime: currentTime,
        endTime: segmentEnd,
        hasVoice,
        confidence
      });
    }
    
    // Avancer avec chevauchement
    currentTime = segmentEnd - options.overlapDuration;
    if (currentTime >= segmentEnd - 1) {
      currentTime = segmentEnd; // Éviter les boucles infinies
    }
  }
  
  return segments;
}

// Trouver un point de coupe optimal (dans le silence)
function findOptimalCutPoint(
  voiceActivity: Array<{ time: number; isVoice: boolean; energy: number }>,
  searchStart: number,
  searchEnd: number
): number {
  const candidates = voiceActivity
    .filter(activity => 
      activity.time >= searchStart && 
      activity.time <= searchEnd && 
      !activity.isVoice
    )
    .sort((a, b) => a.energy - b.energy); // Trier par énergie croissante
  
  return candidates.length > 0 ? candidates[0].time : -1;
}

// Conversion des segments en blobs
async function segments2Blobs(
  audioBuffer: AudioBuffer,
  segments: Array<{ startTime: number; endTime: number }>
): Promise<Blob[]> {
  const blobs: Blob[] = [];
  const sampleRate = audioBuffer.sampleRate;
  
  for (const segment of segments) {
    const startSample = Math.floor(segment.startTime * sampleRate);
    const endSample = Math.floor(segment.endTime * sampleRate);
    const segmentLength = endSample - startSample;
    
    // Créer un nouveau AudioBuffer pour le segment
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const segmentBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      segmentLength,
      sampleRate
    );
    
    // Copier les données audio
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const targetData = segmentBuffer.getChannelData(channel);
      
      for (let i = 0; i < segmentLength; i++) {
        targetData[i] = sourceData[startSample + i] || 0;
      }
    }
    
    // Convertir en WAV blob
    const wavBlob = await audioBuffer2WAV(segmentBuffer);
    blobs.push(wavBlob);
    
    await audioContext.close();
  }
  
  return blobs;
}

// Conversion AudioBuffer vers WAV Blob
async function audioBuffer2WAV(audioBuffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  
  // Interleaver les canaux
  const interleaved = new Float32Array(length * numberOfChannels);
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      interleaved[i * numberOfChannels + channel] = channelData[i];
    }
  }
  
  // Convertir en 16-bit PCM
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.floor(interleaved[i] * 32768)));
  }
  
  // Créer l'en-tête WAV
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  
  return new Blob([header, pcm.buffer], { type: 'audio/wav' });
}