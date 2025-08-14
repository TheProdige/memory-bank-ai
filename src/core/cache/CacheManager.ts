/**
 * Advanced Cache Management System
 * Multi-layer caching with intelligent eviction and persistence
 */

import { Logger } from '@/core/logging/Logger';

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: string[];
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size in bytes
  maxItems?: number; // Maximum number of items
  tags?: string[]; // Tags for bulk operations
  priority?: 'low' | 'normal' | 'high';
}

class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;
  private memoryCache = new Map<string, CacheItem>();
  private persistentCache: IDBDatabase | null = null;
  private maxMemorySize = 50 * 1024 * 1024; // 50MB
  private maxMemoryItems = 1000;
  private currentMemorySize = 0;

  private constructor() {
    this.initializePersistentCache();
    this.setupPeriodicCleanup();
  }

  public static getInstance(): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager();
    }
    return AdvancedCacheManager.instance;
  }

  private async initializePersistentCache(): Promise<void> {
    try {
      const request = indexedDB.open('EchoVaultCache', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('tags', 'tags', { multiEntry: true });
          store.createIndex('expiresAt', 'expiresAt');
        }
      };

      request.onsuccess = (event) => {
        this.persistentCache = (event.target as IDBOpenDBRequest).result;
        Logger.info('Persistent cache initialized');
      };

      request.onerror = (event) => {
        Logger.error('Failed to initialize persistent cache', { error: (event.target as IDBOpenDBRequest).error });
      };
    } catch (error) {
      Logger.error('IndexedDB not supported', { error });
    }
  }

  private setupPeriodicCleanup(): void {
    // Clean up expired items every 5 minutes
    setInterval(() => {
      this.cleanupExpiredItems();
    }, 5 * 60 * 1000);

    // Run LRU eviction when memory usage is high
    setInterval(() => {
      if (this.currentMemorySize > this.maxMemorySize * 0.8) {
        this.evictLRUItems();
      }
    }, 30 * 1000);
  }

  public async set<T>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): Promise<void> {
    const {
      ttl,
      maxSize = this.maxMemorySize,
      tags = [],
      priority = 'normal'
    } = options;

    const size = this.calculateSize(data);
    const expiresAt = ttl ? Date.now() + ttl : undefined;

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
      tags,
    };

    // Memory cache
    if (size <= maxSize) {
      this.memoryCache.set(key, item);
      this.currentMemorySize += size;
      
      // Evict if necessary
      if (this.memoryCache.size > this.maxMemoryItems || 
          this.currentMemorySize > this.maxMemorySize) {
        this.evictLRUItems();
      }
    }

    // Persistent cache for important data
    if (priority === 'high' && this.persistentCache) {
      await this.setPersistent(key, item);
    }

    Logger.debug('Cache item set', { key, size, ttl, tags });
  }

  public async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    let item = this.memoryCache.get(key);
    
    // If not in memory, try persistent cache
    if (!item && this.persistentCache) {
      item = await this.getPersistent(key);
      
      // Promote to memory cache if found
      if (item) {
        this.memoryCache.set(key, item);
        this.currentMemorySize += item.size;
      }
    }

    if (!item) {
      Logger.debug('Cache miss', { key });
      return null;
    }

    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key);
      Logger.debug('Cache item expired', { key });
      return null;
    }

    // Update access statistics
    item.accessCount++;
    item.lastAccessed = Date.now();

    Logger.debug('Cache hit', { key, accessCount: item.accessCount });
    return item.data as T;
  }

  public async delete(key: string): Promise<void> {
    const item = this.memoryCache.get(key);
    if (item) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= item.size;
    }

    if (this.persistentCache) {
      await this.deletePersistent(key);
    }

    Logger.debug('Cache item deleted', { key });
  }

  public async clear(tags?: string[]): Promise<void> {
    if (tags && tags.length > 0) {
      // Clear by tags
      const keysToDelete: string[] = [];
      
      this.memoryCache.forEach((item, key) => {
        if (item.tags.some(tag => tags.includes(tag))) {
          keysToDelete.push(key);
        }
      });

      for (const key of keysToDelete) {
        await this.delete(key);
      }

      // Clear from persistent cache by tags
      if (this.persistentCache) {
        await this.clearPersistentByTags(tags);
      }
    } else {
      // Clear all
      this.memoryCache.clear();
      this.currentMemorySize = 0;

      if (this.persistentCache) {
        await this.clearPersistent();
      }
    }

    Logger.info('Cache cleared', { tags });
  }

  public has(key: string): boolean {
    return this.memoryCache.has(key);
  }

  public keys(): string[] {
    return Array.from(this.memoryCache.keys());
  }

  public size(): number {
    return this.memoryCache.size;
  }

  public getMemoryUsage(): { size: number; items: number; percentage: number } {
    return {
      size: this.currentMemorySize,
      items: this.memoryCache.size,
      percentage: (this.currentMemorySize / this.maxMemorySize) * 100,
    };
  }

  public getStats(): any {
    const stats = {
      totalItems: this.memoryCache.size,
      totalSize: this.currentMemorySize,
      maxSize: this.maxMemorySize,
      hitRate: 0,
      mostAccessed: '',
    };

    let totalAccess = 0;
    let maxAccess = 0;
    let mostAccessedKey = '';

    this.memoryCache.forEach((item, key) => {
      totalAccess += item.accessCount;
      if (item.accessCount > maxAccess) {
        maxAccess = item.accessCount;
        mostAccessedKey = key;
      }
    });

    stats.mostAccessed = mostAccessedKey;
    return stats;
  }

  private calculateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  private evictLRUItems(): void {
    const items = Array.from(this.memoryCache.entries());
    
    // Sort by last accessed time and access count (LRU + LFU hybrid)
    items.sort(([, a], [, b]) => {
      const aPriority = a.lastAccessed + (a.accessCount * 1000);
      const bPriority = b.lastAccessed + (b.accessCount * 1000);
      return aPriority - bPriority;
    });

    // Remove 25% of items
    const itemsToRemove = Math.floor(items.length * 0.25);
    
    for (let i = 0; i < itemsToRemove; i++) {
      const [key, item] = items[i];
      this.memoryCache.delete(key);
      this.currentMemorySize -= item.size;
    }

    Logger.info('LRU eviction completed', { 
      itemsRemoved: itemsToRemove,
      remainingItems: this.memoryCache.size,
      memoryUsage: this.currentMemorySize 
    });
  }

  private cleanupExpiredItems(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.memoryCache.forEach((item, key) => {
      if (item.expiresAt && now > item.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      const item = this.memoryCache.get(key);
      if (item) {
        this.memoryCache.delete(key);
        this.currentMemorySize -= item.size;
      }
    });

    if (expiredKeys.length > 0) {
      Logger.info('Expired items cleaned up', { count: expiredKeys.length });
    }
  }

  // Persistent cache operations
  private async setPersistent(key: string, item: CacheItem): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve, reject) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      const request = store.put({ key, ...item });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getPersistent(key: string): Promise<CacheItem | null> {
    if (!this.persistentCache) return null;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { key: _, ...item } = result;
          resolve(item as CacheItem);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => resolve(null);
    });
  }

  private async deletePersistent(key: string): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  private async clearPersistent(): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      store.clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  private async clearPersistentByTags(tags: string[]): Promise<void> {
    if (!this.persistentCache) return;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('tags');
      
      tags.forEach(tag => {
        const request = index.openCursor(IDBKeyRange.only(tag));
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}

export const CacheManager = AdvancedCacheManager.getInstance();

// Utility functions for easy caching
export const withCache = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  options?: CacheOptions
): T => {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    
    // Try to get from cache first
    const cached = await CacheManager.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await CacheManager.set(key, result, options);
    
    return result;
  }) as T;
};