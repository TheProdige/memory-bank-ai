import { pipeline } from "@huggingface/transformers";

export type STTLanguageHint = "fr" | "en" | "auto";

export interface LocalTranscriptionOptions {
  languageHint?: STTLanguageHint;
  chunkLengthSec?: number; // 30–60s recommended
  strideLengthSec?: number; // overlap for better stitching
  onProgress?: (p: number, step?: string) => void;
}

export interface LocalTranscriptionResult {
  text: string;
  language?: string;
  timestamps?: Array<{ text: string; start: number; end: number }>;
  engine: "whisper";
  elapsedMs: number;
}

let transcriberPromise: Promise<any> | null = null;

async function getTranscriber(languageHint: STTLanguageHint = "auto") {
  if (!transcriberPromise) {
    // Choose a small model by default to minimize compute and download size
    // - en: tiny.en (fastest)
    // - fr/auto: tiny (multilingual). You can switch to "whisper-small" for higher quality at higher cost
    const model = languageHint === "en"
      ? "onnx-community/whisper-tiny.en"
      : "onnx-community/whisper-tiny";

    transcriberPromise = pipeline(
      "automatic-speech-recognition",
      model,
      {
        // Let the library pick the best available backend (WebGPU/WebGL/WASM)
        // You can force WebGPU with: { device: "webgpu" }
      }
    );
  }
  return transcriberPromise;
}

export async function transcribeAudioLocal(
  audioBlob: Blob,
  {
    languageHint = "auto",
    chunkLengthSec = 30,
    strideLengthSec = 5,
    onProgress,
  }: LocalTranscriptionOptions = {}
): Promise<LocalTranscriptionResult> {
  const started = performance.now();
  onProgress?.(5, "Chargement du modèle (local)");

  const asr = await getTranscriber(languageHint);
  onProgress?.(10, "Préparation audio");

  // Create URL for the blob so transformers can load/stream it internally
  const url = URL.createObjectURL(audioBlob);

  try {
    onProgress?.(25, "Transcription locale en cours");
    const output: any = await asr(url, {
      chunk_length_s: chunkLengthSec,
      stride_length_s: strideLengthSec,
      return_timestamps: true,
      language: languageHint === "auto" ? undefined : languageHint,
    });

    // Expected output: { text, chunks?: [{timestamp:[start,end], text}] }
    const timestamps = (output.chunks || []).map((c: any) => ({
      text: c.text?.trim?.() ?? "",
      start: Array.isArray(c.timestamp) ? c.timestamp[0] ?? 0 : 0,
      end: Array.isArray(c.timestamp) ? c.timestamp[1] ?? 0 : 0,
    }));

    const elapsedMs = performance.now() - started;
    onProgress?.(100, "Terminé");

    return {
      text: String(output.text || "").trim(),
      language: output.language || languageHint,
      timestamps,
      engine: "whisper",
      elapsedMs,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
