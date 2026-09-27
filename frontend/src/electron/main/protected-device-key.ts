export type ProtectedKeyPersistence = {
  get(): string | null;
  set(value: string): void;
  clear(): void;
};

export type SafeStoragePort = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Uint8Array;
  decryptString(value: Uint8Array): string;
};

function toBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

export function createProtectedDeviceKeyStore(
  persistence: ProtectedKeyPersistence,
  safeStorage: SafeStoragePort,
  generateKey: () => Uint8Array = () => crypto.getRandomValues(new Uint8Array(32)),
) {
  return {
    async getOrCreate(): Promise<Uint8Array> {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("Electron OS-protected storage is unavailable.");
      }

      const stored = persistence.get();
      if (stored) {
        const decoded = fromBase64(safeStorage.decryptString(fromBase64(stored)));
        if (decoded.byteLength !== 32) throw new Error("Stored device key is invalid.");
        return decoded;
      }

      const key = generateKey();
      if (key.byteLength !== 32) throw new Error("Generated device key is invalid.");
      const protectedValue = safeStorage.encryptString(toBase64(key));
      persistence.set(toBase64(protectedValue));
      return key;
    },
    clear(): void {
      persistence.clear();
    },
  };
}
