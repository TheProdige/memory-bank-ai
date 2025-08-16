/**
 * Input Validation Service - World-class security
 * Implements OWASP best practices for input validation
 */

import { z } from 'zod'
import DOMPurify from 'dompurify'

export class InputValidator {
  private static instance: InputValidator
  
  // Common validation patterns
  private static readonly PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    SAFE_STRING: /^[a-zA-Z0-9\s\-_.,!?()[\]{}:;"']+$/,
    FILE_NAME: /^[a-zA-Z0-9\s\-_.()]+\.[a-zA-Z0-9]{1,10}$/,
    SQL_INJECTION: /(union|select|insert|update|delete|drop|create|alter|exec|execute|\-\-|\/\*|\*\/|xp_|sp_)/i,
    XSS_BASIC: /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=|<iframe[^>]*>.*?<\/iframe>/gi,
    PATH_TRAVERSAL: /\.\.|\/\.\.|\\\.\.|\.\.\\/gi
  } as const

  // Schema definitions for common inputs
  public static readonly schemas = {
    fileUpload: z.object({
      name: z.string()
        .min(1, 'Nom de fichier requis')
        .max(255, 'Nom de fichier trop long')
        .regex(InputValidator.PATTERNS.FILE_NAME, 'Nom de fichier invalide'),
      size: z.number()
        .positive('Taille de fichier invalide')
        .max(50 * 1024 * 1024, 'Fichier trop volumineux (max 50MB)'),
      type: z.string()
        .min(1, 'Type de fichier requis')
        .refine(
          (type) => InputValidator.isAllowedMimeType(type),
          'Type de fichier non autorisé'
        )
    }),
    
    searchQuery: z.string()
      .min(1, 'Requête vide')
      .max(1000, 'Requête trop longue')
      .refine(
        (query) => !InputValidator.containsSqlInjection(query),
        'Caractères dangereux détectés'
      ),
      
    userContent: z.string()
      .max(10000, 'Contenu trop long')
      .refine(
        (content) => !InputValidator.containsXSS(content),
        'Contenu potentiellement dangereux'
      ),
      
    id: z.string()
      .uuid('ID invalide')
      .transform(String)
  } as const

  private constructor() {}

  public static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator()
    }
    return InputValidator.instance
  }

  /**
   * Sanitize HTML content using DOMPurify
   */
  public sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false
    })
  }

  /**
   * Sanitize plain text input
   */
  public sanitizeText(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim()
  }

  /**
   * Validate and sanitize file upload
   */
  public validateFileUpload(file: File): {
    isValid: boolean
    errors: string[]
    sanitizedName?: string
  } {
    const errors: string[] = []
    
    try {
      // Validate using schema
      InputValidator.schemas.fileUpload.parse({
        name: file.name,
        size: file.size,
        type: file.type
      })

      // Additional security checks
      if (this.containsPathTraversal(file.name)) {
        errors.push('Nom de fichier contient des caractères dangereux')
      }

      if (this.containsNullBytes(file.name)) {
        errors.push('Nom de fichier contient des caractères null')
      }

      // Sanitize filename
      const sanitizedName = this.sanitizeFileName(file.name)

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedName
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => e.message)
        }
      }
      
      return {
        isValid: false,
        errors: ['Erreur de validation inattendue']
      }
    }
  }

  /**
   * Validate search query
   */
  public validateSearchQuery(query: string): {
    isValid: boolean
    sanitized: string
    errors: string[]
  } {
    const errors: string[] = []
    
    try {
      const validated = InputValidator.schemas.searchQuery.parse(query)
      const sanitized = this.sanitizeText(validated)
      
      return {
        isValid: true,
        sanitized,
        errors: []
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          sanitized: this.sanitizeText(query),
          errors: error.errors.map(e => e.message)
        }
      }
      
      return {
        isValid: false,
        sanitized: this.sanitizeText(query),
        errors: ['Erreur de validation inattendue']
      }
    }
  }

  /**
   * Check for SQL injection patterns
   */
  private static containsSqlInjection(input: string): boolean {
    return InputValidator.PATTERNS.SQL_INJECTION.test(input)
  }

  /**
   * Check for XSS patterns
   */
  private static containsXSS(input: string): boolean {
    return InputValidator.PATTERNS.XSS_BASIC.test(input)
  }

  /**
   * Check for path traversal
   */
  private containsPathTraversal(input: string): boolean {
    return InputValidator.PATTERNS.PATH_TRAVERSAL.test(input)
  }

  /**
   * Check for null bytes
   */
  private containsNullBytes(input: string): boolean {
    return input.includes('\0') || input.includes('%00')
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(filename: string): string {
    return filename
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      .replace(/\.\./g, '')
      .replace(/^\.+|\.+$/g, '')
      .trim()
      .slice(0, 255)
  }

  /**
   * Check if MIME type is allowed
   */
  private static isAllowedMimeType(mimeType: string): boolean {
    const allowedTypes = [
      // Documents
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      
      // Images
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      
      // Audio
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/m4a',
      'audio/ogg',
      
      // Video
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]
    
    return allowedTypes.includes(mimeType.toLowerCase())
  }

  /**
   * Validate UUID
   */
  public validateUuid(uuid: string): boolean {
    return InputValidator.PATTERNS.UUID.test(uuid)
  }

  /**
   * Validate email
   */
  public validateEmail(email: string): boolean {
    return InputValidator.PATTERNS.EMAIL.test(email)
  }

  /**
   * Rate limiting validation
   */
  public validateRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    
    const storageKey = `rate_limit_${key}_${windowStart}`
    const current = parseInt(localStorage.getItem(storageKey) || '0')
    
    if (current >= limit) {
      return false
    }
    
    localStorage.setItem(storageKey, (current + 1).toString())
    
    // Cleanup old entries
    setTimeout(() => {
      localStorage.removeItem(storageKey)
    }, windowMs)
    
    return true
  }
}

export const inputValidator = InputValidator.getInstance()