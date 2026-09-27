import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptJson, encryptJson } from "./crypto.ts";

const key = Uint8Array.from({ length: 32 }, (_, index) => index);

test("AES-256-GCM encrypts and decrypts a JSON payload", async () => {
  const payload = { doc_type: "billing", total: 1250.5, items: [{ amount: 1250.5 }] };
  const encrypted = await encryptJson(payload, key, 1);

  assert.equal(encrypted.keyVersion, 1);
  assert.equal(encrypted.iv.length, 16);
  assert.notEqual(encrypted.ciphertext, "");
  assert.deepEqual(await decryptJson(encrypted, key), payload);
});

test("AES-256-GCM uses a fresh IV for every write", async () => {
  const first = await encryptJson({ value: "same" }, key, 1);
  const second = await encryptJson({ value: "same" }, key, 1);

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("AES-256-GCM rejects tampered ciphertext and wrong keys", async () => {
  const encrypted = await encryptJson({ sensitive: true }, key, 1);
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` };
  const wrongKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);

  await assert.rejects(() => decryptJson(tampered, key));
  await assert.rejects(() => decryptJson(encrypted, wrongKey));
});

test("AES-256-GCM rejects malformed key material", async () => {
  await assert.rejects(() => encryptJson({ value: 1 }, new Uint8Array(31), 1), /32 bytes/);
});
