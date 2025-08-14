/**
 * Centralized Logging System
 * Professional logging with levels, formatting, and external service integration
 */

import { config } from '@/core/config/env';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
  userId?: string;
  sessionId?: string;
}

class LoggerService {
  private static instance: LoggerService;
  private logLevel: LogLevel;
  private sessionId: string;
  private userId?: string;

  private constructor() {
    this.logLevel = config.app.environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public clearUserId(): void {
    this.userId = undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${levelNames[level]}] ${message}`;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context,
      userId: this.userId,
      sessionId: this.sessionId,
    };
  }

  private async sendToExternalService(entry: LogEntry): Promise<void> {
    if (!config.features.enableAnalytics) return;

    try {
      // In a real app, this would send to your logging service
      // For now, we'll just store in localStorage for debugging
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push(entry);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }

  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, data, context);
    const formattedMessage = this.formatMessage(level, message);

    // Console output with appropriate method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data);
        break;
    }

    // Send to external service asynchronously
    this.sendToExternalService(entry);
  }

  public debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  public info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  public warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  public error(message: string, data?: any, context?: string): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  // Performance logging
  public startTimer(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.info(`Timer: ${label}`, { duration: `${duration.toFixed(2)}ms` });
    };
  }

  // API call logging
  public logApiCall(method: string, url: string, status: number, duration: number): void {
    this.info('API Call', {
      method,
      url,
      status,
      duration: `${duration.toFixed(2)}ms`,
    });
  }

  // User action logging
  public logUserAction(action: string, data?: any): void {
    this.info(`User Action: ${action}`, data, 'user_action');
  }

  // Get logs for debugging
  public getLogs(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('app_logs') || '[]');
    } catch {
      return [];
    }
  }

  // Clear logs
  public clearLogs(): void {
    localStorage.removeItem('app_logs');
  }
}

export const Logger = LoggerService.getInstance();
