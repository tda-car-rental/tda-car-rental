export type BlobStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
};

export type DeviceKeyProvider = {
  getKey(): Promise<CryptoKey>;
  clear(): void;
};

type CacheEnvelope = {
  version: 1;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function createDeviceKeyProvider(): DeviceKeyProvider {
  let keyPromise: Promise<CryptoKey> | null = null;

  return {
    getKey() {
      keyPromise ??= crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      return keyPromise;
    },
    clear() {
      keyPromise = null;
    },
  };
}

export function createEncryptedLocalCache(store: BlobStore, keyProvider: DeviceKeyProvider) {
  return {
    async get<T>(key: string): Promise<T | null> {
      const stored = await store.get(key);
      if (stored === null) return null;

      const envelope = JSON.parse(stored) as CacheEnvelope;
      if (envelope.version !== 1 || !envelope.iv || !envelope.ciphertext) {
        throw new Error("Invalid local cache envelope.");
      }

      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(envelope.iv) },
        await keyProvider.getKey(),
        fromBase64(envelope.ciphertext),
      );
      return JSON.parse(decoder.decode(plaintext)) as T;
    },
    async put<T>(key: string, value: T): Promise<void> {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await keyProvider.getKey(),
        encoder.encode(JSON.stringify(value)),
      );
      await store.set(
        key,
        JSON.stringify({ version: 1, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) }),
      );
    },
    remove(key: string): Promise<void> {
      return store.delete(key);
    },
    clear(): Promise<void> {
      return store.clear();
    },
  };
}

export function createMemoryBlobStore(): BlobStore {
  const records = new Map<string, string>();
  return {
    async get(key) {
      return records.get(key) ?? null;
    },
    async set(key, value) {
      records.set(key, value);
    },
    async delete(key) {
      records.delete(key);
    },
    async clear() {
      records.clear();
    },
  };
}
