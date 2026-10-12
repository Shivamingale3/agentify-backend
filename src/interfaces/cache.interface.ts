export interface CacheProvider {
  checkConnection: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
}
