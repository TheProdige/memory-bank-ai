// Moteur d'intelligence proactive pour EchoVault
import { costEnforcer } from './CostEnforcer';
import { localVectorSearch, generateLocalSummary } from '@/lib/localModels';
import { analyzeComplexity } from '@/lib/complexityDetector';
import { Logger } from '@/core/logging/Logger';
import { supabase } from '@/integrations/supabase/client';

export interface ProactiveBrief {
  id: string;
  title: string;
  summary: string; // Max 120 mots
  actions: ProactiveAction[];
  relevantMemories: string[];
  confidence: number;
  generatedAt: Date;
  eventDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface ProactiveAction {
  id: string;
  text: string;
  type: 'remind' | 'prepare' | 'research' | 'contact';
  deadline?: Date;
  completed: boolean;
}

export interface ContextualEvent {
  id: string;
  title: string;
  date: Date;
  type: 'calendar' | 'deadline' | 'recurring' | 'inferred';
  description?: string;
  location?: string;
  participants?: string[];
}

export class ProactiveEngine {
  private static instance: ProactiveEngine;
  private isProcessing = false;
  private lastProcessing = 0;
  private processingInterval = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    this.startPeriodicProcessing();
  }

  public static getInstance(): ProactiveEngine {
    if (!ProactiveEngine.instance) {
      ProactiveEngine.instance = new ProactiveEngine();
    }
    return ProactiveEngine.instance;
  }

  // Démarrage du traitement périodique
  private startPeriodicProcessing(): void {
    setInterval(() => {
      this.processProactiveIntelligence();
    }, this.processingInterval);

    // Traitement initial après 30 secondes
    setTimeout(() => {
      this.processProactiveIntelligence();
    }, 30000);
  }

  // Traitement principal de l'intelligence proactive
  public async processProactiveIntelligence(): Promise<ProactiveBrief[]> {
    if (this.isProcessing) {
      Logger.info('Proactive processing already in progress, skipping');
      return [];
    }

    try {
      this.isProcessing = true;
      this.lastProcessing = Date.now();
      
      Logger.info('Starting proactive intelligence processing');

      // 1. Détecter les événements à venir
      const upcomingEvents = await this.detectUpcomingEvents();
      
      if (upcomingEvents.length === 0) {
        Logger.info('No upcoming events detected');
        return [];
      }

      // 2. Générer des briefs pour chaque événement
      const briefs: ProactiveBrief[] = [];
      
      for (const event of upcomingEvents) {
        const brief = await this.generateEventBrief(event);
        if (brief) {
          briefs.push(brief);
        }
      }

      // 3. Sauvegarder et notifier
      for (const brief of briefs) {
        await this.saveBrief(brief);
        await this.sendNotification(brief);
      }

      Logger.info('Proactive processing completed', { 
        eventsProcessed: upcomingEvents.length,
        briefsGenerated: briefs.length 
      });

      return briefs;

    } catch (error) {
      Logger.error('Error in proactive processing', { error });
      return [];
    } finally {
      this.isProcessing = false;
    }
  }

  // Détection des événements à venir
  private async detectUpcomingEvents(): Promise<ContextualEvent[]> {
    const events: ContextualEvent[] = [];
    const now = new Date();
    const lookAheadHours = 24; // Regarder 24h à l'avance
    const lookAheadTime = new Date(now.getTime() + lookAheadHours * 60 * 60 * 1000);

    try {
      // Récupérer les mémoires récentes pour chercher des indices d'événements
      const { data: memories, error } = await supabase
        .from('memories')
        .select('id, title, transcript, summary, created_at')
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 derniers jours
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Analyse des mémoires pour détecter des événements
      for (const memory of memories || []) {
        const text = `${memory.title || ''} ${memory.transcript || ''} ${memory.summary || ''}`;
        const detectedEvents = this.extractEventsFromText(text, memory.id);
        
        // Filtrer les événements dans la fenêtre temporelle
        const relevantEvents = detectedEvents.filter(event => 
          event.date >= now && event.date <= lookAheadTime
        );
        
        events.push(...relevantEvents);
      }

      // Déduplication des événements similaires
      const uniqueEvents = this.deduplicateEvents(events);
      
      Logger.info('Events detected', { total: events.length, unique: uniqueEvents.length });
      
      return uniqueEvents;

    } catch (error) {
      Logger.error('Error detecting events', { error });
      return [];
    }
  }

  // Extraction d'événements depuis le texte
  private extractEventsFromText(text: string, memoryId: string): ContextualEvent[] {
    const events: ContextualEvent[] = [];
    const normalizedText = text.toLowerCase();

    // Patterns de détection d'événements
    const eventPatterns = [
      // Rendez-vous
      /(?:rdv|rendez[- ]vous|réunion|meeting)\s+(?:le\s+)?(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)\s*(?:à\s+(\d{1,2}[h:]\d{0,2}))?/gi,
      // Deadline
      /(?:deadline|échéance|date limite|à rendre)\s+(?:le\s+)?(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)/gi,
      // Événements
      /(?:demain|après[- ]demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(?:à\s+(\d{1,2}[h:]\d{0,2}))?/gi
    ];

    eventPatterns.forEach((pattern, index) => {
      const matches = [...normalizedText.matchAll(pattern)];
      
      matches.forEach(match => {
        const dateStr = match[1];
        const timeStr = match[2];
        
        const eventDate = this.parseEventDate(dateStr, timeStr);
        if (eventDate && eventDate > new Date()) {
          events.push({
            id: `${memoryId}_${index}_${events.length}`,
            title: this.extractEventTitle(text, match.index || 0),
            date: eventDate,
            type: index === 0 ? 'calendar' : index === 1 ? 'deadline' : 'inferred',
            description: text.slice(Math.max(0, (match.index || 0) - 50), (match.index || 0) + 100)
          });
        }
      });
    });

    return events;
  }

  // Parse d'une date d'événement
  private parseEventDate(dateStr?: string, timeStr?: string): Date | null {
    if (!dateStr) return null;

    try {
      const now = new Date();
      let eventDate: Date;

      // Format DD/MM ou DD/MM/YYYY
      if (dateStr.includes('/') || dateStr.includes('-') || dateStr.includes('.')) {
        const parts = dateStr.split(/[\/\-\.]/);
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
        const year = parts.length > 2 ? parseInt(parts[2]) : now.getFullYear();
        
        eventDate = new Date(year < 100 ? 2000 + year : year, month, day);
      } else {
        return null;
      }

      // Ajouter l'heure si fournie
      if (timeStr) {
        const timeParts = timeStr.split(/[h:]/);
        const hours = parseInt(timeParts[0]);
        const minutes = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
        
        eventDate.setHours(hours, minutes, 0, 0);
      } else {
        eventDate.setHours(9, 0, 0, 0); // Heure par défaut: 9h
      }

      return eventDate;
    } catch (error) {
      return null;
    }
  }

  // Extraction du titre d'événement
  private extractEventTitle(text: string, matchIndex: number): string {
    const start = Math.max(0, matchIndex - 30);
    const end = Math.min(text.length, matchIndex + 50);
    const context = text.slice(start, end);
    
    // Extraire une phrase cohérente
    const sentences = context.split(/[.!?]/);
    const relevantSentence = sentences.find(s => s.length > 10 && s.length < 80);
    
    return relevantSentence?.trim() || 'Événement détecté';
  }

  // Déduplication des événements
  private deduplicateEvents(events: ContextualEvent[]): ContextualEvent[] {
    const unique: ContextualEvent[] = [];
    
    for (const event of events) {
      const isDuplicate = unique.some(existing => {
        const timeDiff = Math.abs(existing.date.getTime() - event.date.getTime());
        const titleSimilar = this.calculateStringSimilarity(existing.title, event.title) > 0.7;
        
        return timeDiff < 2 * 60 * 60 * 1000 && titleSimilar; // 2h de différence max
      });
      
      if (!isDuplicate) {
        unique.push(event);
      }
    }
    
    return unique;
  }

  // Génération d'un brief pour un événement
  private async generateEventBrief(event: ContextualEvent): Promise<ProactiveBrief | null> {
    try {
      // 1. Rechercher des mémoires pertinentes
      const relevantMemories = await this.findRelevantMemories(event);
      
      if (relevantMemories.length === 0) {
        Logger.info('No relevant memories found for event', { eventId: event.id });
        return null;
      }

      // 2. Vérifier les contraintes de coût
      const complexity = analyzeComplexity(event.title + ' ' + (event.description || ''));
      const costDecision = await costEnforcer.shouldProceed(
        'generate_brief',
        500, // Estimation tokens
        0.01, // Estimation coût
        'medium'
      );

      if (!costDecision.allowed) {
        Logger.info('Brief generation blocked by cost enforcer', { 
          reason: costDecision.reason,
          eventId: event.id 
        });
        return null;
      }

      // 3. Générer le résumé localement
      const combinedContext = relevantMemories
        .map(m => `${m.title || ''} ${m.content}`)
        .join(' ')
        .slice(0, 2000); // Limiter la taille

      const summaryResult = generateLocalSummary(combinedContext, {
        maxLength: 120, // Contrainte: max 120 mots
        style: 'concise'
      });

      // 4. Générer les actions recommandées
      const actions = this.generateRecommendedActions(event, relevantMemories);

      // 5. Calculer la priorité
      const priority = this.calculateEventPriority(event, relevantMemories);

      const brief: ProactiveBrief = {
        id: `brief_${event.id}_${Date.now()}`,
        title: `Préparation: ${event.title}`,
        summary: summaryResult.text,
        actions,
        relevantMemories: relevantMemories.map(m => m.id),
        confidence: summaryResult.confidence,
        generatedAt: new Date(),
        eventDate: event.date,
        priority
      };

      Logger.info('Brief generated successfully', { 
        eventId: event.id, 
        briefId: brief.id,
        actionsCount: actions.length,
        confidence: brief.confidence
      });

      return brief;

    } catch (error) {
      Logger.error('Error generating event brief', { error, eventId: event.id });
      return null;
    }
  }

  // Recherche de mémoires pertinentes
  private async findRelevantMemories(event: ContextualEvent): Promise<any[]> {
    try {
      const { data: memories, error } = await supabase
        .from('memories')
        .select('id, title, transcript, summary, tags')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!memories) return [];

      // Recherche vectorielle locale
      const searchQuery = `${event.title} ${event.description || ''}`;
      const results = localVectorSearch(
        searchQuery,
        memories.map(m => ({
          id: m.id,
          content: `${m.title || ''} ${m.transcript || ''} ${m.summary || ''}`,
          title: m.title
        })),
        5 // Top 5 résultats
      );

      return results.map(result => {
        const memory = memories.find(m => m.id === result.id);
        return {
          ...memory,
          content: result.excerpt,
          relevanceScore: result.score
        };
      }).filter(m => m.relevanceScore > 0.3); // Seuil de pertinence

    } catch (error) {
      Logger.error('Error finding relevant memories', { error });
      return [];
    }
  }

  // Génération d'actions recommandées
  private generateRecommendedActions(event: ContextualEvent, memories: any[]): ProactiveAction[] {
    const actions: ProactiveAction[] = [];
    
    // Action par défaut: se préparer
    actions.push({
      id: `action_${event.id}_prepare`,
      text: `Réviser les points clés pour ${event.title}`,
      type: 'prepare',
      deadline: new Date(event.date.getTime() - 2 * 60 * 60 * 1000), // 2h avant
      completed: false
    });

    // Actions basées sur le type d'événement
    if (event.type === 'calendar' && event.title.toLowerCase().includes('réunion')) {
      actions.push({
        id: `action_${event.id}_agenda`,
        text: 'Préparer l\'ordre du jour de la réunion',
        type: 'prepare',
        deadline: new Date(event.date.getTime() - 4 * 60 * 60 * 1000),
        completed: false
      });
    }

    if (event.type === 'deadline') {
      actions.push({
        id: `action_${event.id}_reminder`,
        text: 'Rappel: finaliser le livrable',
        type: 'remind',
        deadline: new Date(event.date.getTime() - 24 * 60 * 60 * 1000), // 24h avant
        completed: false
      });
    }

    // Actions basées sur les mémoires pertinentes
    if (memories.some(m => m.content.toLowerCase().includes('présentation'))) {
      actions.push({
        id: `action_${event.id}_slides`,
        text: 'Vérifier et mettre à jour la présentation',
        type: 'prepare',
        deadline: new Date(event.date.getTime() - 6 * 60 * 60 * 1000),
        completed: false
      });
    }

    return actions.slice(0, 3); // Max 3 actions
  }

  // Calcul de la priorité d'un événement
  private calculateEventPriority(event: ContextualEvent, memories: any[]): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Facteurs de priorité
    const timeUntilEvent = event.date.getTime() - Date.now();
    const hoursUntil = timeUntilEvent / (1000 * 60 * 60);
    
    // Plus proche = plus prioritaire
    if (hoursUntil < 6) score += 3;
    else if (hoursUntil < 24) score += 2;
    else score += 1;
    
    // Mots-clés importants
    const importantKeywords = ['important', 'urgent', 'critique', 'priorité', 'deadline'];
    const text = `${event.title} ${event.description || ''}`.toLowerCase();
    importantKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 2;
    });
    
    // Nombre de mémoires pertinentes
    if (memories.length > 3) score += 2;
    else if (memories.length > 1) score += 1;
    
    // Type d'événement
    if (event.type === 'deadline') score += 2;
    else if (event.type === 'calendar') score += 1;
    
    // Classification finale
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  // Sauvegarde d'un brief
  private async saveBrief(brief: ProactiveBrief): Promise<void> {
    try {
      // Sauvegarder localement pour le MVP
      const stored = localStorage.getItem('proactive_briefs_db') || '[]';
      const briefs = JSON.parse(stored);
      briefs.push(brief);
      localStorage.setItem('proactive_briefs_db', JSON.stringify(briefs));
      
      Logger.info('Brief saved locally', { briefId: brief.id });
    } catch (error) {
      Logger.error('Error saving brief', { error, briefId: brief.id });
    }
  }

  // Envoi de notification
  private async sendNotification(brief: ProactiveBrief): Promise<void> {
    try {
      // Notification in-app via le store global
      const notification = {
        id: `notif_${brief.id}`,
        type: 'info' as const,
        title: brief.title,
        message: brief.summary.slice(0, 100) + '...',
        timestamp: new Date(),
        actions: brief.actions.slice(0, 2).map(action => ({
          label: action.text,
          action: () => this.markActionCompleted(action.id),
          variant: 'default' as const
        }))
      };

      // Ajouter à la queue des notifications
      const notificationQueue = JSON.parse(localStorage.getItem('notification_queue') || '[]');
      notificationQueue.push(notification);
      localStorage.setItem('notification_queue', JSON.stringify(notificationQueue));

      Logger.info('Notification sent', { briefId: brief.id, title: brief.title });
    } catch (error) {
      Logger.error('Error sending notification', { error, briefId: brief.id });
    }
  }

  // Marquer une action comme complétée
  private async markActionCompleted(actionId: string): Promise<void> {
    try {
      // Mettre à jour localement pour le MVP
      const stored = localStorage.getItem('completed_actions') || '[]';
      const completed = JSON.parse(stored);
      if (!completed.includes(actionId)) {
        completed.push(actionId);
        localStorage.setItem('completed_actions', JSON.stringify(completed));
      }
      
      Logger.info('Action marked as completed', { actionId });
    } catch (error) {
      Logger.error('Error marking action as completed', { error, actionId });
    }
  }

  // Utilitaire pour calculer la similarité entre chaînes
  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // API publique pour forcer un traitement
  public async forceProcessing(): Promise<ProactiveBrief[]> {
    Logger.info('Force processing requested');
    return this.processProactiveIntelligence();
  }

  // État du moteur
  public getStatus(): { isProcessing: boolean; lastProcessing: number; nextProcessing: number } {
    return {
      isProcessing: this.isProcessing,
      lastProcessing: this.lastProcessing,
      nextProcessing: this.lastProcessing + this.processingInterval
    };
  }
}

// Export singleton
export const proactiveEngine = ProactiveEngine.getInstance();