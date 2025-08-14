// Détecteur de complexité pour router vers modèles locaux vs API
export interface ComplexityAnalysis {
  score: number; // 0-1, 1 = très complexe
  reasoning: string;
  suggestedModel: 'local' | 'api';
  factors: {
    length: number;
    technicalTerms: number;
    emotions: number;
    multiLanguage: boolean;
    context: number;
  };
}

// Dictionnaires pour la détection
const TECHNICAL_TERMS = [
  'algorithme', 'api', 'backend', 'database', 'framework', 'machine learning',
  'intelligence artificielle', 'blockchain', 'cybersécurité', 'devops',
  'microservices', 'cloud', 'kubernetes', 'docker', 'typescript', 'python',
  'médical', 'juridique', 'financier', 'scientifique', 'académique'
];

const EMOTION_WORDS = [
  'amour', 'haine', 'joie', 'tristesse', 'colère', 'peur', 'surprise',
  'dégoût', 'anxiété', 'stress', 'dépression', 'euphorie', 'nostalgie',
  'mélancolie', 'passion', 'frustration', 'espoir', 'désespoir'
];

const MULTI_LANG_PATTERNS = [
  /[a-z]+@[a-z]+\.[a-z]+/i, // emails
  /https?:\/\/[^\s]+/i, // URLs
  /[а-я]+/i, // cyrillique
  /[你我他她它们]/g, // chinois
  /[الأن]/g, // arabe
  /[はがをに]/g // japonais
];

export function analyzeComplexity(text: string, context?: {
  hasAudio?: boolean;
  duration?: number;
  previousMessages?: string[];
  userTier?: 'free' | 'pro';
}): ComplexityAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      score: 0,
      reasoning: 'Texte vide',
      suggestedModel: 'local',
      factors: { length: 0, technicalTerms: 0, emotions: 0, multiLanguage: false, context: 0 }
    };
  }

  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  
  // Facteur 1: Longueur (>300 mots = complexe)
  const lengthFactor = Math.min(words.length / 300, 1);
  
  // Facteur 2: Termes techniques
  const technicalCount = TECHNICAL_TERMS.filter(term => 
    normalizedText.includes(term.toLowerCase())
  ).length;
  const technicalFactor = Math.min(technicalCount / 5, 1);
  
  // Facteur 3: Émotions complexes
  const emotionCount = EMOTION_WORDS.filter(emotion => 
    normalizedText.includes(emotion.toLowerCase())
  ).length;
  const emotionFactor = Math.min(emotionCount / 3, 1);
  
  // Facteur 4: Multi-langue
  const multiLanguage = MULTI_LANG_PATTERNS.some(pattern => pattern.test(text));
  const multiLangFactor = multiLanguage ? 0.8 : 0;
  
  // Facteur 5: Contexte (si audio long ou plusieurs messages)
  let contextFactor = 0;
  if (context?.duration && context.duration > 180) contextFactor += 0.3; // >3min
  if (context?.previousMessages && context.previousMessages.length > 2) contextFactor += 0.2;
  if (context?.hasAudio) contextFactor += 0.1;
  contextFactor = Math.min(contextFactor, 1);
  
  // Score final pondéré
  const score = (
    lengthFactor * 0.3 +
    technicalFactor * 0.25 +
    emotionFactor * 0.2 +
    multiLangFactor * 0.15 +
    contextFactor * 0.1
  );
  
  // Seuil ajusté selon le tier utilisateur
  const complexityThreshold = context?.userTier === 'pro' ? 0.6 : 0.75;
  const suggestedModel = score > complexityThreshold ? 'api' : 'local';
  
  const reasoning = [
    lengthFactor > 0.5 && `Texte long (${words.length} mots)`,
    technicalCount > 0 && `${technicalCount} terme(s) technique(s)`,
    emotionCount > 0 && `${emotionCount} émotion(s) détectée(s)`,
    multiLanguage && 'Multi-langue détecté',
    contextFactor > 0 && 'Contexte complexe'
  ].filter(Boolean).join(', ') || 'Analyse simple';
  
  return {
    score: Math.round(score * 100) / 100,
    reasoning,
    suggestedModel,
    factors: {
      length: lengthFactor,
      technicalTerms: technicalFactor,
      emotions: emotionFactor,
      multiLanguage,
      context: contextFactor
    }
  };
}

// Helper pour forcer un modèle spécifique
export function forceModelChoice(analysis: ComplexityAnalysis, model: 'local' | 'api'): ComplexityAnalysis {
  return {
    ...analysis,
    suggestedModel: model,
    reasoning: `${analysis.reasoning} (forcé vers ${model})`
  };
}