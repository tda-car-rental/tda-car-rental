type IndexedDbPort = Pick<IDBFactory, "open">;

type BrowserCacheOptions = {
  databaseName?: string;
  storeName?: string;
  indexedDB?: IndexedDbPort;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function createIndexedDbBlobStore({
  databaseName = "tda-car-rental-cache",
  storeName = "encrypted-blobs",
  indexedDB = globalThis.indexedDB,
}: BrowserCacheOptions = {}) {
  if (!indexedDB) throw new Error("IndexedDB is unavailable in this environment.");

  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = () => {
    databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
    });
    return databasePromise;
  };

  return {
    async get(key: string): Promise<string | null> {
      const db = await database();
      const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
      return (await requestToPromise<string | undefined>(request)) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      const db = await database();
      await requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).put(value, key));
    },
    async delete(key: string): Promise<void> {
      const db = await database();
      await requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).delete(key));
    },
    async clear(): Promise<void> {
      const db = await database();
      await requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).clear());
    },
  };
}
