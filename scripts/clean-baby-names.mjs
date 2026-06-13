#!/usr/bin/env node
/**
 * Clean, merge, and normalize baby name CSVs from ~/Work into hub public JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WORK_ROOT = '/Users/sujitdebbarma/Work';
const OUT_FILE = path.join(REPO_ROOT, 'apps/hub/public/data/babyNames.json');

const HONORIFIC_PATTERN =
  /^(smt\.?|km\.?|kumari|shri\.?|sri\.?|sh\.|mr\.?|mrs\.?|ms\.?|miss\.?|dr\.?|prof\.?|lt\.?|col\.?|maj\.?|gen\.?|master\.?|sir\.?|md\.?|mohd\.?|mohammad\.?|muhammad\.?|smt|km|shri|sri)[\s.]*/i;

const SOURCES = [
  {
    file: 'Indian-Female-Names.csv',
    origin: 'Indian',
    defaultGender: 'Female',
    parser: 'indian',
  },
  {
    file: 'Indian-Male-Names.csv',
    origin: 'Indian',
    defaultGender: 'Male',
    parser: 'indian',
  },
  {
    file: 'Foreign_Country_baby_names.csv',
    origin: 'Foreign',
    defaultGender: null,
    parser: 'ssa',
  },
  {
    file: 'Foreign_Country_baby-names.csv',
    origin: 'Foreign',
    defaultGender: null,
    parser: 'nameSex',
  },
  {
    file: 'top-100-baby-names-2023.csv',
    origin: 'Foreign',
    defaultGender: null,
    parser: 'top100',
  },
];

function resolveCsvPath(filename) {
  const candidates = [
    path.join(WORK_ROOT, filename),
    path.join(WORK_ROOT, 'Projects', filename),
    path.join(REPO_ROOT, filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function stripHonorifics(raw) {
  let name = String(raw ?? '').trim().toLowerCase();
  let prev;
  do {
    prev = name;
    name = name.replace(HONORIFIC_PATTERN, '').trim();
  } while (name !== prev && name.length > 0);
  return name;
}

function cleanFirstName(raw) {
  let name = stripHonorifics(raw);
  if (!name) return '';

  name = name.replace(/[^a-z\s]/gi, ' ');
  name = name.replace(/\s+/g, ' ').trim();

  const first = name.split(' ')[0] ?? '';
  if (!first || first.length < 2 || !/^[a-z]+$/i.test(first)) return '';

  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function normalizeGender(raw, fallback) {
  const g = String(raw ?? '').trim().toLowerCase();
  if (g === 'm' || g === 'male' || g === 'boy' || g === 'boys') return 'Male';
  if (g === 'f' || g === 'female' || g === 'girl' || g === 'girls') return 'Female';
  if (fallback === 'Male' || fallback === 'Female') return fallback;
  return null;
}

/** Regex-based English syllable estimate (minimum 1 for valid names). */
function countSyllables(name) {
  const word = name.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 2) return 1;

  let w = word
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');

  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.map((p) => p.replace(/^"|"$/g, ''));
}

function parseIndianCsv(text, defaultGender) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const header = lines[0].toLowerCase();
  const start = header.includes('name') ? 1 : 0;
  const rows = [];

  for (let i = start; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    rows.push({ name: parts[0], gender: parts[1] ?? defaultGender });
  }
  return rows;
}

function parseSsaCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.indexOf('name');
  const sexIdx = header.indexOf('sex');
  if (nameIdx === -1 || sexIdx === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    rows.push({ name: parts[nameIdx], gender: parts[sexIdx] });
  }
  return rows;
}

function parseNameSexCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.indexOf('name');
  const sexIdx = header.findIndex((h) => h === 'sex' || h === 'gender');
  const start = nameIdx >= 0 ? 1 : 0;
  const rows = [];

  for (let i = start; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const name = nameIdx >= 0 ? parts[nameIdx] : parts[0];
    const gender = sexIdx >= 0 ? parts[sexIdx] : parts[1];
    rows.push({ name, gender });
  }
  return rows;
}

function parseTop100Csv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts[0]) rows.push({ name: parts[0], gender: 'Female' });
    if (parts[2]) rows.push({ name: parts[2], gender: 'Male' });
  }
  return rows;
}

function parseSource(text, source) {
  switch (source.parser) {
    case 'indian':
      return parseIndianCsv(text, source.defaultGender);
    case 'ssa':
      return parseSsaCsv(text);
    case 'nameSex':
      return parseNameSexCsv(text);
    case 'top100':
      return parseTop100Csv(text);
    default:
      return [];
  }
}

function ingestRow(row, origin, defaultGender, seen, entries) {
  const gender = normalizeGender(row.gender, defaultGender);
  if (!gender) return false;

  const name = cleanFirstName(row.name);
  if (!name) return false;

  const key = `${origin}|${gender}|${name.toLowerCase()}`;
  if (seen.has(key)) return false;

  seen.add(key);
  entries.push({
    name,
    gender,
    origin,
    syllables: countSyllables(name),
  });
  return true;
}

function main() {
  const seen = new Set();
  const entries = [];
  const stats = [];

  for (const source of SOURCES) {
    const csvPath = resolveCsvPath(source.file);
    if (!csvPath) {
      console.error(`Missing CSV: ${source.file} (checked ${WORK_ROOT} and ${WORK_ROOT}/Projects)`);
      process.exit(1);
    }

    const text = fs.readFileSync(csvPath, 'utf8');
    const rows = parseSource(text, source);
    let kept = 0;

    for (const row of rows) {
      if (ingestRow(row, source.origin, source.defaultGender, seen, entries)) kept++;
    }

    stats.push({ file: source.file, parsed: rows.length, kept, path: csvPath });
    console.log(`✓ ${source.file}: ${rows.length} rows → ${kept} unique (${csvPath})`);
  }

  entries.sort((a, b) => a.name.localeCompare(b.name) || a.origin.localeCompare(b.origin));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(entries));

  const indianCount = entries.filter((e) => e.origin === 'Indian').length;
  const foreignCount = entries.filter((e) => e.origin === 'Foreign').length;
  const maleCount = entries.filter((e) => e.gender === 'Male').length;
  const femaleCount = entries.filter((e) => e.gender === 'Female').length;

  console.log('\n--- Summary ---');
  console.log(`Total unique names: ${entries.length.toLocaleString()}`);
  console.log(`Indian: ${indianCount.toLocaleString()}`);
  console.log(`Foreign: ${foreignCount.toLocaleString()}`);
  console.log(`Male: ${maleCount.toLocaleString()}`);
  console.log(`Female: ${femaleCount.toLocaleString()}`);
  console.log(`Output: ${OUT_FILE}`);
}

main();
