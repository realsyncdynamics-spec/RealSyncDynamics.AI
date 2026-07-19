/**
 * Request Queue — Manage concurrent requests with priority support
 */

type Priority = 'low' | 'normal' | 'high';

interface QueueItem<T> {
  id: string;
  fn: () => Promise<T>;
  priority: Priority;
  retries: number;
  maxRetries: number;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  createdAt: number;
}

interface QueueConfig {
  concurrency: number;
  timeout: number;
  retries: number;
}

export class RequestQueue {
  private queue: QueueItem<any>[] = [];
  private activeRequests = 0;
  private config: Required<QueueConfig>;
  private priorityWeights = { high: 3, normal: 2, low: 1 };

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrency: config.concurrency ?? 3,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    };
  }

  add<T>(
    fn: () => Promise<T>,
    options: { priority?: Priority; retries?: number } = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        id: Math.random().toString(36).substr(2, 9),
        fn,
        priority: options.priority ?? 'normal',
        retries: 0,
        maxRetries: options.retries ?? this.config.retries,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      this.queue.push(item);
      this.sort();
      this.process();
    });
  }

  private sort(): void {
    this.queue.sort((a, b) => {
      // Higher priority first
      const priorityDiff = this.priorityWeights[b.priority] - this.priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Earlier created first (FIFO within same priority)
      return a.createdAt - b.createdAt;
    });
  }

  private async process(): Promise<void> {
    if (this.activeRequests >= this.config.concurrency || this.queue.length === 0) {
      return;
    }

    this.activeRequests++;
    const item = this.queue.shift()!;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
      );

      const result = await Promise.race([item.fn(), timeoutPromise]);
      item.resolve(result);
    } catch (error) {
      if (item.retries < item.maxRetries) {
        item.retries++;
        this.queue.push(item); // Re-queue with delay
        this.sort();
      } else {
        item.reject(error);
      }
    } finally {
      this.activeRequests--;
      this.process(); // Process next item
    }
  }

  getSize(): number {
    return this.queue.length;
  }

  getActive(): number {
    return this.activeRequests;
  }

  clear(): void {
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  async waitUntilEmpty(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.queue.length === 0 && this.activeRequests === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  getStats() {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      config: this.config,
    };
  }
}

/**
 * Batch request processor
 */
export class BatchProcessor<T, R> {
  constructor(
    private batchFn: (batch: T[]) => Promise<R[]>,
    private config = { batchSize: 20, flushInterval: 5000 }
  ) {}

  private batch: T[] = [];
  private promises: Array<{
    resolve: (value: R) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private flushTimer: NodeJS.Timeout | null = null;

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push(item);
      this.promises.push({ resolve, reject });

      if (this.batch.length >= this.config.batchSize) {
        this.flush();
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), this.config.flushInterval);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length === 0) return;

    const batch = this.batch;
    const promises = this.promises;

    this.batch = [];
    this.promises = [];

    try {
      const results = await this.batchFn(batch);
      results.forEach((result, idx) => {
        promises[idx]?.resolve(result);
      });
    } catch (error) {
      promises.forEach((p) => p.reject(error));
    }
  }

  async flush_(): Promise<void> {
    return this.flush();
  }
}
