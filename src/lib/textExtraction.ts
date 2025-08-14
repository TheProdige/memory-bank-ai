// Local text extraction utilities for EchoVault
// Implements local-first text extraction from various file formats

interface ExtractionResult {
  text: string
  metadata?: {
    pages?: number
    language?: string
    confidence?: number
  }
  error?: string
}

// Extract text from plain text files
export const extractFromText = async (file: File): Promise<ExtractionResult> => {
  try {
    const text = await file.text()
    return { 
      text,
      metadata: { 
        language: detectLanguage(text),
        confidence: 1.0
      }
    }
  } catch (error) {
    return { 
      text: '',
      error: `Erreur lors de la lecture du fichier texte: ${error}` 
    }
  }
}

// Basic language detection
const detectLanguage = (text: string): string => {
  const sample = text.slice(0, 500).toLowerCase()
  
  // French indicators
  const frenchWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'une', 'que', 'dans', 'pour', 'avec', 'sur']
  const frenchCount = frenchWords.filter(word => 
    new RegExp(`\\b${word}\\b`, 'g').test(sample)
  ).length

  // English indicators  
  const englishWords = ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on']
  const englishCount = englishWords.filter(word => 
    new RegExp(`\\b${word}\\b`, 'g').test(sample)
  ).length

  return frenchCount > englishCount ? 'fr' : 'en'
}

// Extract text from PDF (browser-based, limited)
export const extractFromPDF = async (file: File): Promise<ExtractionResult> => {
  try {
    // For basic PDF text extraction, we'd need a library like PDF.js
    // For now, return placeholder indicating server-side processing needed
    return {
      text: '',
      metadata: { pages: 0 },
      error: 'Extraction PDF nécessite un traitement serveur. Utilisez l\'option "Analyser via GPT/Claude".'
    }
  } catch (error) {
    return {
      text: '',
      error: `Erreur lors de l'extraction PDF: ${error}`
    }
  }
}

// Extract text from DOCX (limited browser support)
export const extractFromDOCX = async (file: File): Promise<ExtractionResult> => {
  try {
    // DOCX extraction in browser would require libraries like mammoth.js
    // For now, return placeholder
    return {
      text: '',
      error: 'Extraction DOCX nécessite un traitement serveur. Utilisez l\'option "Analyser via GPT/Claude".'
    }
  } catch (error) {
    return {
      text: '',
      error: `Erreur lors de l'extraction DOCX: ${error}`
    }
  }
}

// Extract text from images using OCR (placeholder for Tesseract.js integration)
export const extractFromImage = async (file: File): Promise<ExtractionResult> => {
  try {
    // For OCR, we could integrate Tesseract.js
    // For now, return placeholder
    return {
      text: '',
      metadata: { confidence: 0 },
      error: 'OCR local en cours de développement. Utilisez l\'option "Analyser via GPT/Claude" pour l\'extraction de texte d\'images.'
    }
  } catch (error) {
    return {
      text: '',
      error: `Erreur lors de l'OCR: ${error}`
    }
  }
}

// Main text extraction function
export const extractTextFromFile = async (file: File): Promise<ExtractionResult> => {
  const mimeType = file.type.toLowerCase()
  
  // Route to appropriate extractor based on file type
  if (mimeType === 'text/plain') {
    return extractFromText(file)
  }
  
  if (mimeType === 'application/pdf') {
    return extractFromPDF(file)
  }
  
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractFromDOCX(file)
  }
  
  if (mimeType.startsWith('image/')) {
    return extractFromImage(file)
  }
  
  // Audio/video files don't have text to extract directly
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return {
      text: '',
      error: 'Les fichiers audio/vidéo nécessitent une transcription. Utilisez la fonction de transcription dédiée.'
    }
  }
  
  return {
    text: '',
    error: `Type de fichier non supporté pour l'extraction de texte: ${mimeType}`
  }
}

// Clean and optimize extracted text
export const cleanExtractedText = (text: string): string => {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove repeated characters (more than 3 in a row)
    .replace(/(.)\1{3,}/g, '$1$1$1')
    // Remove common OCR artifacts
    .replace(/[^\w\s\.,;:!?'"()[\]{}-]/g, ' ')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Trim and normalize
    .trim()
}

// Split text into chunks for indexing
export const chunkText = (text: string, maxChunkSize: number = 800, overlap: number = 100): string[] => {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChunkSize
    
    // Try to end at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end)
      const lastNewline = text.lastIndexOf('\n', end)
      const boundary = Math.max(lastPeriod, lastNewline)
      
      if (boundary > start + maxChunkSize * 0.5) {
        end = boundary + 1
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end - overlap
  }

  return chunks.filter(chunk => chunk.length > 0)
}