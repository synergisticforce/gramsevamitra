import { Capacitor } from '@capacitor/core';

/**
 * Optional PIN lock for the document vault.
 *
 * This gates access to the vault screen. It deliberately does NOT encrypt the
 * stored files: deriving the encryption key from the PIN would mean a forgotten
 * PIN destroys every saved land record and ID — an unacceptable outcome for the
 * people this app serves. The PIN itself is never stored, only a salted
 * PBKDF2 hash.
 */

const STORAGE_KEY = 'gsm.vault.lock.v1';
const PBKDF2_ITERATIONS = 150_000;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;

interface StoredLock {
  salt: string;
  hash: string;
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readStored(): Promise<StoredLock | null> {
  let raw: string | null = null;

  try {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      raw = (await Preferences.get({ key: STORAGE_KEY })).value ?? null;
    } else {
      raw = window.localStorage.getItem(STORAGE_KEY);
    }
  } catch {
    return null;
  }

  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredLock;
    return parsed?.salt && parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

async function writeStored(value: StoredLock | null): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    if (value) {
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(value) });
    } else {
      await Preferences.remove({ key: STORAGE_KEY });
    }
    return;
  }

  if (value) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export function isVaultLockSupported(): boolean {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'Use numbers only.';
  if (pin.length < MIN_PIN_LENGTH) return `Use at least ${MIN_PIN_LENGTH} digits.`;
  if (pin.length > MAX_PIN_LENGTH) return `Use at most ${MAX_PIN_LENGTH} digits.`;
  return null;
}

export async function isVaultLockEnabled(): Promise<boolean> {
  return (await readStored()) !== null;
}

export async function setVaultPin(pin: string): Promise<void> {
  const problem = validatePin(pin);
  if (problem) throw new Error(problem);
  if (!isVaultLockSupported()) {
    throw new Error('This device cannot set a PIN lock.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, PBKDF2_ITERATIONS);
  await writeStored({ salt: toBase64(salt), hash, iterations: PBKDF2_ITERATIONS });
}

export async function verifyVaultPin(pin: string): Promise<boolean> {
  const stored = await readStored();
  if (!stored) return true;
  if (!/^\d+$/.test(pin)) return false;

  const candidate = await derive(pin, fromBase64(stored.salt), stored.iterations);
  if (candidate.length !== stored.hash.length) return false;

  // Constant-time compare so a wrong PIN cannot be probed by timing.
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    mismatch |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Removing the lock requires the current PIN so a passer-by cannot disable it. */
export async function removeVaultPin(currentPin: string): Promise<void> {
  const ok = await verifyVaultPin(currentPin);
  if (!ok) throw new Error('That PIN is not correct.');
  await writeStored(null);
}
