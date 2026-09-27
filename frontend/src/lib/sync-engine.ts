export type SyncQueueCache = {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  clear(): Promise<void>;
};

type SyncApi = {
  sync(workspaceId: string, mutation: Record<string, unknown>): Promise<unknown>;
};

type QueuedMutation = {
  mutationId: string;
  operation: string;
  [key: string]: unknown;
};

const QUEUE_KEY = "sync-queue";

export function createSyncEngine(options: {
  cache: SyncQueueCache;
  api: SyncApi;
  workspaceId: string;
  createMutationId?: () => string;
}) {
  const createMutationId = options.createMutationId ?? (() => crypto.randomUUID());
  let flushPromise: Promise<void> | null = null;

  async function readQueue(): Promise<QueuedMutation[]> {
    const queue = await options.cache.get<QueuedMutation[]>(QUEUE_KEY);
    return Array.isArray(queue) ? queue : [];
  }

  async function writeQueue(queue: QueuedMutation[]): Promise<void> {
    await options.cache.put(QUEUE_KEY, queue);
  }

  async function runFlush(): Promise<void> {
    while (true) {
      const queue = await readQueue();
      const mutation = queue[0];
      if (!mutation) return;
      await options.api.sync(options.workspaceId, mutation);
      await writeQueue(queue.slice(1));
    }
  }

  return {
    async enqueue(mutation: Omit<QueuedMutation, "mutationId">): Promise<string> {
      const mutationId = createMutationId();
      const queue = await readQueue();
      await writeQueue([...queue, { ...mutation, mutationId } as QueuedMutation]);
      return mutationId;
    },
    pending(): Promise<QueuedMutation[]> {
      return readQueue();
    },
    async flush(): Promise<void> {
      if (!flushPromise) {
        flushPromise = runFlush().finally(() => {
          flushPromise = null;
        });
      }
      return flushPromise;
    },
    clear(): Promise<void> {
      return options.cache.clear();
    },
  };
}
