#!/usr/bin/env node
/**
 * Ingest Indian baby name CSVs from repo root into apps/hub/public/data/babyNames.json
 *
 * Expected files (repo root):
 *   - Indian-Male-Names.csv
 *   - Indian-Female-Names.csv
 *
 * CSV headers: name,gender,race
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'apps/hub/public/data');
const OUT_FILE = path.join(OUT_DIR, 'babyNames.json');

const CSV_FILES = [
  { file: 'Indian-Male-Names.csv', defaultGender: 'Boy' },
  { file: 'Indian-Female-Names.csv', defaultGender: 'Girl' },
];

function resolveCsvPath(filename) {
  const candidates = [
    path.join(ROOT, filename),
    path.join(process.env.HOME ?? '', 'Downloads', filename),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function capitalizeName(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function mapGender(raw, fallback) {
  const g = String(raw ?? '').trim().toLowerCase();
  if (g === 'm' || g === 'male' || g === 'boy') return 'Boy';
  if (g === 'f' || g === 'female' || g === 'girl') return 'Girl';
  return fallback;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('name') && header.includes('gender');
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      return { name: parts[0], gender: parts[1], race: parts[2] };
    })
    .filter((row) => row.name);
}

function syllableCount(name) {
  const vowels = name.toLowerCase().match(/[aeiouy]+/g);
  return Math.max(1, vowels?.length ?? 1);
}

function ingest() {
  const entries = [];
  const seen = new Set();

  for (const { file, defaultGender } of CSV_FILES) {
    const csvPath = resolveCsvPath(file);
    if (!csvPath) {
      console.error(`Missing CSV: ${file} (checked repo root and ~/Downloads)`);
      process.exit(1);
    }

    const text = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCsv(text);

    for (const row of rows) {
      const name = capitalizeName(row.name);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      entries.push({
        name,
        origin: 'Indian',
        gender: mapGender(row.gender, defaultGender),
        syllables: syllableCount(name),
        meaning: '',
      });
    }

    console.log(`✓ ${file}: ${rows.length} rows parsed (${csvPath})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(entries, null, 0));

  console.log(`✓ Wrote ${entries.length} names → ${OUT_FILE}`);
}

ingest();
