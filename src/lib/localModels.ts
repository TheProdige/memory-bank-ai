// Interface unifiée pour les modèles locaux
export interface LocalModelResult {
  text: string;
  confidence: number;
  model: string;
  processingTime: number;
  fallbackReason?: string;
}

export interface LocalSummaryOptions {
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'bullet-points';
  language?: 'fr' | 'en' | 'auto';
}

export interface LocalCategorizationResult {
  category: string;
  confidence: number;
  tags: string[];
  emotion?: string;
  sentiment?: number;
}

// Modèle de résumé local simple (règles heuristiques)
export function generateLocalSummary(
  text: string, 
  options: LocalSummaryOptions = {}
): LocalModelResult {
  const startTime = performance.now();
  
  if (!text || text.trim().length === 0) {
    return {
      text: '',
      confidence: 0,
      model: 'local-summary-heuristic',
      processingTime: 0
    };
  }

  const { maxLength = 150, style = 'concise' } = options;
  
  // Nettoyage et préparation
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
  
  if (sentences.length === 0) {
    return {
      text: text.slice(0, maxLength),
      confidence: 0.3,
      model: 'local-summary-heuristic',
      processingTime: performance.now() - startTime
    };
  }

  // Scoring des phrases (heuristiques simples)
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    
    // Longueur optimale (ni trop courte ni trop longue)
    const length = sentence.split(' ').length;
    if (length >= 5 && length <= 20) score += 2;
    
    // Mots-clés importants
    const keywords = ['important', 'essentiel', 'principal', 'clé', 'majeur', 'crucial'];
    keywords.forEach(keyword => {
      if (sentence.toLowerCase().includes(keyword)) score += 3;
    });
    
    // Position (début souvent plus important)
    const index = sentences.indexOf(sentence);
    if (index < sentences.length * 0.3) score += 1;
    
    // Éviter les phrases de transition
    const transitions = ['par ailleurs', 'en outre', 'cependant', 'néanmoins'];
    if (transitions.some(t => sentence.toLowerCase().includes(t))) score -= 1;
    
    return { sentence, score };
  });
  
  // Sélection des meilleures phrases
  const bestSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, style === 'detailed' ? 4 : style === 'bullet-points' ? 5 : 2)
    .map(item => item.sentence);
  
  // Formatage selon le style
  let summary = '';
  if (style === 'bullet-points') {
    summary = bestSentences.map(s => `• ${s}`).join('\n');
  } else {
    summary = bestSentences.join('. ');
  }
  
  // Limitation de taille
  if (summary.length > maxLength) {
    summary = summary.slice(0, maxLength - 3) + '...';
  }
  
  const confidence = Math.min(0.8, 0.4 + (bestSentences.length * 0.1));
  
  return {
    text: summary,
    confidence,
    model: 'local-summary-heuristic',
    processingTime: performance.now() - startTime
  };
}

// Catégorisation locale simple
export function categorizeLocally(text: string): LocalCategorizationResult {
  const normalizedText = text.toLowerCase();
  
  // Dictionnaires de catégories
  const categories = {
    'personnel': ['vie', 'famille', 'ami', 'personnel', 'intime', 'privé', 'souvenir'],
    'travail': ['travail', 'bureau', 'projet', 'équipe', 'client', 'réunion', 'professionnel'],
    'apprentissage': ['apprendre', 'étudier', 'formation', 'cours', 'lecture', 'découverte'],
    'créatif': ['idée', 'créer', 'inspiration', 'art', 'design', 'musique', 'écriture'],
    'santé': ['santé', 'médecin', 'sport', 'exercice', 'bien-être', 'nutrition'],
    'voyage': ['voyage', 'vacances', 'découvrir', 'pays', 'culture', 'aventure'],
    'technologie': ['tech', 'ordinateur', 'application', 'code', 'digital', 'innovation'],
    'finance': ['argent', 'budget', 'investir', 'économie', 'dépense', 'revenus']
  };
  
  // Score par catégorie
  const scores: Record<string, number> = {};
  Object.entries(categories).forEach(([category, keywords]) => {
    scores[category] = keywords.reduce((score, keyword) => {
      const matches = (normalizedText.match(new RegExp(keyword, 'g')) || []).length;
      return score + matches;
    }, 0);
  });
  
  // Meilleure catégorie
  const bestCategory = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)[0];
  
  const [category, score] = bestCategory;
  const confidence = Math.min(0.9, Math.max(0.1, score / 3));
  
  // Génération de tags simples
  const words = normalizedText.split(/\s+/).filter(w => w.length > 3);
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'que', 'qui', 'dans', 'pour', 'avec', 'sur', 'par', 'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une'];
  const tags = [...new Set(words)]
    .filter(w => !commonWords.includes(w) && w.length > 3)
    .slice(0, 5);
  
  // Détection d'émotion simple
  const emotions = {
    'joyeux': ['heureux', 'joie', 'content', 'ravi', 'super', 'génial'],
    'triste': ['triste', 'déprimé', 'mélancolique', 'down', 'mal'],
    'excité': ['excité', 'enthousiaste', 'motivé', 'énergique'],
    'calme': ['calme', 'serein', 'paisible', 'tranquille'],
    'stressé': ['stress', 'anxieux', 'nerveux', 'tendu']
  };
  
  let detectedEmotion = 'neutre';
  let maxEmotionScore = 0;
  
  Object.entries(emotions).forEach(([emotion, keywords]) => {
    const emotionScore = keywords.reduce((score, keyword) => {
      return score + (normalizedText.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (emotionScore > maxEmotionScore) {
      maxEmotionScore = emotionScore;
      detectedEmotion = emotion;
    }
  });
  
  // Sentiment basique (-1 à 1)
  const positiveWords = ['bien', 'bon', 'super', 'génial', 'parfait', 'excellent'];
  const negativeWords = ['mal', 'mauvais', 'nul', 'horrible', 'terrible', 'catastrophe'];
  
  const positiveCount = positiveWords.reduce((count, word) => 
    count + (normalizedText.match(new RegExp(word, 'g')) || []).length, 0);
  const negativeCount = negativeWords.reduce((count, word) => 
    count + (normalizedText.match(new RegExp(word, 'g')) || []).length, 0);
  
  const sentiment = Math.max(-1, Math.min(1, (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount)));
  
  return {
    category: score > 0 ? category : 'général',
    confidence,
    tags,
    emotion: maxEmotionScore > 0 ? detectedEmotion : undefined,
    sentiment: Math.abs(sentiment) > 0.1 ? sentiment : undefined
  };
}

// Recherche vectorielle locale simple (basée sur mots-clés)
export function localVectorSearch(
  query: string, 
  documents: Array<{id: string, content: string, title?: string}>,
  maxResults = 5
): Array<{id: string, score: number, excerpt: string}> {
  if (!query || documents.length === 0) return [];
  
  const queryTerms = query.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2);
  
  if (queryTerms.length === 0) return [];
  
  // Score TF-IDF simplifié
  const results = documents.map(doc => {
    const content = `${doc.title || ''} ${doc.content}`.toLowerCase();
    const words = content.split(/\s+/);
    
    let score = 0;
    queryTerms.forEach(term => {
      const termCount = (content.match(new RegExp(term, 'g')) || []).length;
      const tf = termCount / words.length; // Term frequency
      const idf = Math.log(documents.length / Math.max(1, documents.filter(d => 
        `${d.title || ''} ${d.content}`.toLowerCase().includes(term)
      ).length)); // Inverse document frequency
      
      score += tf * idf;
      
      // Bonus pour titre
      if (doc.title && doc.title.toLowerCase().includes(term)) {
        score += 0.5;
      }
      
      // Bonus pour correspondance exacte
      if (content.includes(query.toLowerCase())) {
        score += 1;
      }
    });
    
    // Extrait pertinent
    const excerptLength = 150;
    let excerpt = doc.content;
    const firstTermIndex = content.indexOf(queryTerms[0]);
    if (firstTermIndex > -1) {
      const start = Math.max(0, firstTermIndex - 50);
      excerpt = doc.content.slice(start, start + excerptLength);
      if (start > 0) excerpt = '...' + excerpt;
      if (start + excerptLength < doc.content.length) excerpt += '...';
    } else if (doc.content.length > excerptLength) {
      excerpt = doc.content.slice(0, excerptLength) + '...';
    }
    
    return {
      id: doc.id,
      score,
      excerpt
    };
  })
  .filter(result => result.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, maxResults);
  
  return results;
}

// Assistant de validation pour décider si le résultat local est suffisant
export function validateLocalResult(
  result: LocalModelResult,
  originalTask: 'summary' | 'categorization' | 'search',
  complexity: number
): { isValid: boolean; reason: string; shouldFallback: boolean } {
  // Seuils de validation
  const confidenceThreshold = complexity > 0.7 ? 0.6 : 0.4;
  const timeThreshold = 5000; // 5 secondes max
  
  // Vérifications
  if (result.confidence < confidenceThreshold) {
    return {
      isValid: false,
      reason: `Confiance trop faible (${result.confidence} < ${confidenceThreshold})`,
      shouldFallback: complexity > 0.5
    };
  }
  
  if (result.processingTime > timeThreshold) {
    return {
      isValid: false,
      reason: `Traitement trop lent (${result.processingTime}ms > ${timeThreshold}ms)`,
      shouldFallback: true
    };
  }
  
  if (!result.text || result.text.trim().length === 0) {
    return {
      isValid: false,
      reason: 'Résultat vide',
      shouldFallback: true
    };
  }
  
  // Validations spécifiques par tâche
  if (originalTask === 'summary' && result.text.length < 20) {
    return {
      isValid: false,
      reason: 'Résumé trop court',
      shouldFallback: complexity > 0.3
    };
  }
  
  return {
    isValid: true,
    reason: 'Résultat local validé',
    shouldFallback: false
  };
}