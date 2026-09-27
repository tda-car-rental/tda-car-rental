export type CiphertextEnvelope = {
  iv: string;
  ciphertext: string;
  keyVersion: number;
};

const AES_KEY_BYTES = 32;
const AES_IV_BYTES = 12;
const AES_TAG_BYTES = 16;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    binary += String.fromCharCode(...value.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("Invalid encrypted payload encoding.");
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validateKey(keyMaterial: Uint8Array): void {
  if (keyMaterial.byteLength !== AES_KEY_BYTES) {
    throw new Error("Encryption key must be exactly 32 bytes.");
  }
}

async function importKey(keyMaterial: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  validateKey(keyMaterial);
  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, [usage]);
}

export async function encryptJson(
  payload: unknown,
  keyMaterial: Uint8Array,
  keyVersion: number,
): Promise<CiphertextEnvelope> {
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Encryption key version must be a positive integer.");
  }

  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const key = await importKey(keyMaterial, "encrypt");
  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: textEncoder.encode(String(keyVersion)) },
    key,
    plaintext,
  );

  return {
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    keyVersion,
  };
}

export async function decryptJson<T = unknown>(
  envelope: CiphertextEnvelope,
  keyMaterial: Uint8Array,
): Promise<T> {
  if (!Number.isInteger(envelope.keyVersion) || envelope.keyVersion < 1) {
    throw new Error("Invalid encryption key version.");
  }

  const iv = decodeBase64(envelope.iv);
  const ciphertext = decodeBase64(envelope.ciphertext);
  if (iv.byteLength !== AES_IV_BYTES || ciphertext.byteLength <= AES_TAG_BYTES) {
    throw new Error("Invalid encrypted payload.");
  }

  const key = await importKey(keyMaterial, "decrypt");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: textEncoder.encode(String(envelope.keyVersion)) },
    key,
    ciphertext,
  );
  return JSON.parse(textDecoder.decode(plaintext)) as T;
}

export function decodeKeyMaterial(value: string): Uint8Array {
  const key = decodeBase64(value);
  validateKey(key);
  return key;
}
