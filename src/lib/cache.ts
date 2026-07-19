/**
 * Caching layer — Memory, IndexedDB, and Cloudflare KV support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheConfig {
  ttl: number;  // Time to live in ms
  maxSize?: number;  // Max entries for in-memory cache
}

/**
 * In-memory LRU cache
 */
export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig) {
    this.config = { ttl: config.ttl, maxSize: config.maxSize || 1000 };
  }

  set(key: string, value: T): void {
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }

    // Check capacity
    if (this.cache.size >= this.config.maxSize) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) this.cache.delete(lruKey);
    }

    const expiresAt = Date.now() + this.config.ttl;
    this.cache.set(key, { value, expiresAt });
    this.accessOrder.push(key);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      return null;
    }

    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * IndexedDB cache for persistent browser storage
 */
export class IndexedDBCache<T = any> {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;

  constructor(
    storeName: string,
    dbName = 'website-operations'
  ) {
    this.storeName = storeName;
    this.dbName = dbName;
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.createStore();
        resolve();
      };

      request.onupgradeneeded = () => {
        this.db = request.result;
        this.createStore();
      };
    });
  }

  private createStore(): void {
    if (!this.db || this.db.objectStoreNames.contains(this.storeName)) {
      return;
    }

    this.db.createObjectStore(this.storeName);
  }

  async set(key: string, value: T, ttl: number = 86400000): Promise<void> {
    await this.initPromise;

    if (!this.db) return;

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(key: string): Promise<T | null> {
    await this.initPromise;

    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        if (Date.now() > entry.expiresAt) {
          this.delete(key); // Clean up expired entry
          resolve(null);
        } else {
          resolve(entry.value);
        }
      };
    });
  }

  async delete(key: string): Promise<void> {
    await this.initPromise;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    await this.initPromise;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * Multi-layer cache with fallback
 */
export class CacheStack<T = any> {
  private memory: MemoryCache<T>;
  private indexedDB: IndexedDBCache<T>;

  constructor(
    storeName: string,
    config: CacheConfig
  ) {
    this.memory = new MemoryCache(config);
    this.indexedDB = new IndexedDBCache(storeName);
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    this.memory.set(key, value);
    await this.indexedDB.set(key, value, ttl);
  }

  async get(key: string): Promise<T | null> {
    // Try memory first
    const memoryValue = this.memory.get(key);
    if (memoryValue) return memoryValue;

    // Try IndexedDB
    const dbValue = await this.indexedDB.get(key);
    if (dbValue) {
      this.memory.set(key, dbValue); // Populate memory cache
      return dbValue;
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
    await this.indexedDB.delete(key);
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await this.indexedDB.clear();
  }
}

/**
 * Utility function for wrapping async operations with caching
 */
export async function withCache<T>(
  cache: MemoryCache<T> | CacheStack<T>,
  key: string,
  fn: () => Promise<T>,
  ttl: number = 300000
): Promise<T> {
  const cached = await cache.get(key);
  if (cached) return cached;

  const result = await fn();
  await cache.set(key, result, ttl);

  return result;
}
