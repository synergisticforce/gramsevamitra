#!/usr/bin/env node
/**
 * Ingest Indian baby name CSVs into apps/hub/public/data/babyNames.json
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

const HONORIFIC_PATTERN =
  /^(smt|smt\.|km|km\.|kumari|shri|shri\.|sri|sri\.|sh|mr|mr\.|mrs|mrs\.|ms|ms\.|dr|dr\.|prof|prof\.|lt|col|maj|gen|miss|master|sir|md|md\.|mohd|mohd\.|@|\.)[\s.]*/i;

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

function stripHonorifics(raw) {
  let name = raw.trim().toLowerCase();
  let prev;
  do {
    prev = name;
    name = name.replace(HONORIFIC_PATTERN, '').trim();
  } while (name !== prev && name.length > 0);
  return name;
}

function sanitizeGivenName(raw) {
  let name = stripHonorifics(String(raw ?? ''));
  if (!name) return '';

  name = name.split('@')[0] ?? name;
  name = name.replace(/[^a-z\s'-]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();

  const first = name.split(' ')[0] ?? '';
  if (!first || first.length < 2 || !/^[a-z'-]+$/.test(first)) return '';

  return first.charAt(0).toUpperCase() + first.slice(1);
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
    let kept = 0;

    for (const row of rows) {
      const name = sanitizeGivenName(row.name);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      kept++;

      entries.push({
        name,
        origin: 'Indian',
        gender: mapGender(row.gender, defaultGender),
        syllables: syllableCount(name),
        meaning: '',
      });
    }

    console.log(`✓ ${file}: ${rows.length} rows parsed, ${kept} unique given names (${csvPath})`);
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(entries, null, 0));

  console.log(`✓ Wrote ${entries.length} unique names → ${OUT_FILE}`);
}

ingest();
