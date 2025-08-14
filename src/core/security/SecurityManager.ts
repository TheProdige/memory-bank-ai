/**
 * Security Manager
 * Handles security measures, input sanitization, and security monitoring
 */

import { Logger } from '@/core/logging/Logger';
import { config } from '@/core/config/env';

interface SecurityPolicy {
  maxFileSize: number; // in bytes
  allowedFileTypes: string[];
  maxRequestsPerMinute: number;
  sessionTimeout: number; // in milliseconds
  requireHTTPS: boolean;
}

interface SecurityEvent {
  type: 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_input' | 'unauthorized_access';
  timestamp: number;
  details: any;
  userAgent?: string;
  ip?: string;
}

class SecurityManagerService {
  private static instance: SecurityManagerService;
  private policy: SecurityPolicy;
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private securityEvents: SecurityEvent[] = [];

  private constructor() {
    this.policy = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedFileTypes: [
        'audio/mpeg',
        'audio/wav',
        'audio/mp4',
        'audio/ogg',
        'audio/webm',
        'text/plain',
        'application/json',
      ],
      maxRequestsPerMinute: 60,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      requireHTTPS: config.app.environment === 'production',
    };

    this.initializeSecurityChecks();
  }

  public static getInstance(): SecurityManagerService {
    if (!SecurityManagerService.instance) {
      SecurityManagerService.instance = new SecurityManagerService();
    }
    return SecurityManagerService.instance;
  }

  private initializeSecurityChecks(): void {
    // Check if HTTPS is enforced in production
    if (this.policy.requireHTTPS && window.location.protocol !== 'https:') {
      this.logSecurityEvent('suspicious_activity', {
        message: 'HTTP access attempted in production',
        protocol: window.location.protocol,
      });
    }

    // Check for common security headers
    this.checkSecurityHeaders();

    // Monitor for XSS attempts
    this.monitorXSSAttempts();
  }

  private checkSecurityHeaders(): void {
    // In a real application, these would be checked server-side
    // This is just for monitoring client-side indicators
    const hasCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!hasCSP && config.app.environment === 'production') {
      Logger.warn('Content Security Policy not detected');
    }
  }

  private monitorXSSAttempts(): void {
    // Monitor for potential XSS in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of urlParams.entries()) {
      if (this.containsPotentialXSS(value)) {
        this.logSecurityEvent('suspicious_activity', {
          type: 'potential_xss',
          parameter: key,
          value: value.substring(0, 100), // Log only first 100 chars
        });
      }
    }
  }

  private containsPotentialXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /eval\s*\(/gi,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  public sanitizeInput(input: string): string {
    // Basic HTML sanitization
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  public validateFileUpload(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > this.policy.maxFileSize) {
      this.logSecurityEvent('invalid_input', {
        type: 'file_too_large',
        fileName: file.name,
        fileSize: file.size,
        maxSize: this.policy.maxFileSize,
      });
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${this.policy.maxFileSize / (1024 * 1024)}MB`,
      };
    }

    // Check file type
    if (!this.policy.allowedFileTypes.includes(file.type)) {
      this.logSecurityEvent('invalid_input', {
        type: 'invalid_file_type',
        fileName: file.name,
        fileType: file.type,
        allowedTypes: this.policy.allowedFileTypes,
      });
      return {
        isValid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    // Check file name for suspicious patterns
    if (this.containsSuspiciousFileName(file.name)) {
      this.logSecurityEvent('suspicious_activity', {
        type: 'suspicious_filename',
        fileName: file.name,
      });
      return {
        isValid: false,
        error: 'File name contains suspicious patterns',
      };
    }

    return { isValid: true };
  }

  private containsSuspiciousFileName(fileName: string): boolean {
    const suspiciousPatterns = [
      /\.\.\//,           // Path traversal
      /[\x00-\x1f]/,    // Control characters
      /[<>:"|?*]/,      // Invalid filename characters
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Reserved Windows names
    ];

    return suspiciousPatterns.some(pattern => pattern.test(fileName));
  }

  public checkRateLimit(identifier: string = 'default'): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000; // Round to minute
    
    const current = this.requestCounts.get(identifier);
    
    if (!current || current.windowStart !== windowStart) {
      this.requestCounts.set(identifier, { count: 1, windowStart });
      return true;
    }

    if (current.count >= this.policy.maxRequestsPerMinute) {
      this.logSecurityEvent('rate_limit_exceeded', {
        identifier,
        count: current.count,
        limit: this.policy.maxRequestsPerMinute,
      });
      return false;
    }

    current.count++;
    return true;
  }

  public validateJSONInput(input: string): { isValid: boolean; parsed?: any; error?: string } {
    try {
      // Check for excessively large JSON
      if (input.length > 1024 * 1024) { // 1MB limit for JSON
        return { isValid: false, error: 'JSON input too large' };
      }

      const parsed = JSON.parse(input);
      
      // Check for dangerous patterns in JSON
      if (this.containsDangerousPatterns(parsed)) {
        this.logSecurityEvent('suspicious_activity', {
          type: 'dangerous_json_pattern',
          inputLength: input.length,
        });
        return { isValid: false, error: 'JSON contains potentially dangerous patterns' };
      }

      return { isValid: true, parsed };
    } catch (error) {
      return { isValid: false, error: 'Invalid JSON format' };
    }
  }

  private containsDangerousPatterns(obj: any, depth = 0): boolean {
    if (depth > 10) return true; // Prevent deep recursion

    if (typeof obj === 'string') {
      return this.containsPotentialXSS(obj);
    }

    if (Array.isArray(obj)) {
      return obj.some(item => this.containsDangerousPatterns(item, depth + 1));
    }

    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(value => this.containsDangerousPatterns(value, depth + 1));
    }

    return false;
  }

  public generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  public validateCSRFToken(token: string, expectedToken: string): boolean {
    if (!token || !expectedToken) return false;
    
    // Use constant-time comparison to prevent timing attacks
    if (token.length !== expectedToken.length) return false;
    
    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }
    
    return result === 0;
  }

  private logSecurityEvent(type: SecurityEvent['type'], details: any): void {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      details,
      userAgent: navigator.userAgent,
    };

    this.securityEvents.push(event);
    
    // Keep only last 100 events
    if (this.securityEvents.length > 100) {
      this.securityEvents.shift();
    }

    Logger.warn(`Security Event: ${type}`, details);
  }

  public getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents];
  }

  public clearSecurityEvents(): void {
    this.securityEvents = [];
  }

  public getSecurityPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  public updateSecurityPolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    Logger.info('Security policy updated', updates);
  }
}

export const SecurityManager = SecurityManagerService.getInstance();
