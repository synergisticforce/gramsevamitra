#!/usr/bin/env node
/**
 * Scaffolds workspace dashboards and micro-tool placeholder routes under apps/hub/src/pages/tools/.
 * Safe to re-run — overwrites generated placeholders only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pagesRoot = path.join(root, 'apps/hub/src/pages/tools');

const WORKSPACES = ['money', 'writing', 'career', 'life', 'quick'];

/** Mirrors apps/hub/src/config/toolsRegistry.ts micro-tool paths. */
const TOOLS = [
  { workspace: 'money', slug: 'emi-calculator', name: 'EMI Calculator', description: 'Calculate monthly loan EMI with principal, rate, and tenure.' },
  { workspace: 'money', slug: 'loan-repayment', name: 'Loan Repayment Planner', description: 'Plan prepayments and see amortization schedules offline.' },
  { workspace: 'money', slug: 'tip-calculator', name: 'Tip Calculator', description: 'Split bills and calculate tips for dining and delivery.' },
  { workspace: 'money', slug: 'multi-currency', name: 'Multi-Currency Converter', description: 'Convert amounts using static offline exchange rates.' },
  { workspace: 'money', slug: 'invoice-builder', name: 'Invoice Builder', description: 'Create client invoices and export as PDF in your browser.' },
  { workspace: 'money', slug: 'pay-stub-generator', name: 'Pay Stub Generator', description: 'Generate simple salary pay stubs for records.' },
  { workspace: 'money', slug: 'meeting-cost', name: 'Meeting Cost Calculator', description: 'Estimate the rupee cost of meetings by attendee salary.' },
  { workspace: 'money', slug: 'tax-deduction-tracker', name: 'Tax Deduction Tracker', description: 'Log deductible expenses for year-end tax planning.' },
  { workspace: 'money', slug: 'crypto-tax', name: 'Crypto Capital Gains', description: 'Simple offline capital gains calculator for crypto trades.' },
  { workspace: 'writing', slug: 'handwriting-converter', name: 'Handwriting Converter', description: 'Turn typed text into a handwritten-style image export.' },
  { workspace: 'writing', slug: 'speech-to-text', name: 'Speech to Text', description: 'Dictate notes using the Web Speech API — fully local.' },
  { workspace: 'writing', slug: 'text-to-speech', name: 'Text to Speech', description: 'Listen to your drafts with browser Speech Synthesis.' },
  { workspace: 'writing', slug: 'citation-generator', name: 'Citation Generator', description: 'Format references in APA, MLA, and Chicago styles.' },
  { workspace: 'writing', slug: 'plagiarism-checker', name: 'Plagiarism Checker', description: 'Compare two texts with client-side diff analysis.' },
  { workspace: 'writing', slug: 'gpa-calculator', name: 'GPA Calculator', description: 'Compute semester and cumulative GPA from grades.' },
  { workspace: 'writing', slug: 'flashcard-maker', name: 'Flashcard Maker', description: 'Highlight text and save cards to a local study deck.' },
  { workspace: 'writing', slug: 'mindmap-builder', name: 'Mind Map Builder', description: 'Visual canvas for brainstorming and topic maps.' },
  { workspace: 'writing', slug: 'phonetic-alphabet', name: 'Phonetic Alphabet (IPA)', description: 'Convert words to IPA phonetic notation.' },
  { workspace: 'career', slug: 'job-tracker', name: 'Job Application Tracker', description: 'Offline Kanban board for tracking job applications.' },
  { workspace: 'career', slug: 'business-card', name: 'Business Card Generator', description: 'Create downloadable vCard contact files.' },
  { workspace: 'career', slug: 'salary-benchmarking', name: 'Salary Benchmarking', description: 'Look up indicative salary ranges from static offline data.' },
  { workspace: 'career', slug: 'skill-gap', name: 'Skill Gap Analyzer', description: 'Compare your skills against a target job description.' },
  { workspace: 'career', slug: 'legal-templates', name: 'Legal Templates', description: 'Fill-in-the-blank NDAs, rental agreements, and more.' },
  { workspace: 'life', slug: 'event-countdown', name: 'Event Countdown', description: 'Count down to exams, birthdays, and important dates.' },
  { workspace: 'life', slug: 'bmi-calculator', name: 'BMI Calculator', description: 'Calculate Body Mass Index from height and weight.' },
  { workspace: 'life', slug: 'body-fat', name: 'Body Fat Calculator', description: 'Estimate body fat percentage from measurements.' },
  { workspace: 'life', slug: 'menstrual-tracker', name: 'Menstrual Cycle Tracker', description: 'Private offline cycle tracking — data never leaves your device.' },
  { workspace: 'life', slug: 'mood-tracker', name: 'Mood Tracker', description: 'Log daily mood patterns stored only in localStorage.' },
  { workspace: 'quick', slug: 'qr-generator', name: 'QR Code Generator', description: 'Create QR codes for URLs, Wi-Fi, and text instantly.' },
  { workspace: 'quick', slug: 'unit-converter', name: 'Unit Converter', description: 'Convert length, weight, temperature, and more.' },
  { workspace: 'quick', slug: 'password-generator', name: 'Password Generator', description: 'Generate strong random passwords offline.' },
  { workspace: 'quick', slug: 'format-converter', name: 'Format Converter', description: 'Convert between CSV, JSON, and XML in the browser.' },
  { workspace: 'quick', slug: 'color-palette', name: 'Color Palette Generator', description: 'Build and export color palettes for design projects.' },
  { workspace: 'quick', slug: 'baby-names', name: 'Baby Name Finder', description: 'Browse and shortlist baby names offline.' },
  { workspace: 'quick', slug: 'decision-wheel', name: 'Decision Wheel', description: 'Spin a wheel to make quick random choices.' },
  { workspace: 'quick', slug: 'seo-meta-tags', name: 'SEO Meta Tag Generator', description: 'Preview and copy HTML meta tags for web pages.' },
  { workspace: 'quick', slug: 'recipe-scaler', name: 'Recipe Scaler', description: 'Scale ingredient quantities up or down for any serving size.' },
  { workspace: 'quick', slug: 'pet-feeding', name: 'Pet Feeding Scheduler', description: 'Plan pet meal times and portions locally.' },
  { workspace: 'quick', slug: 'gardening-planner', name: 'Gardening Planner', description: 'Plan sowing and watering schedules for home gardens.' },
  { workspace: 'quick', slug: 'construction-materials', name: 'Construction Materials Estimator', description: 'Estimate cement, sand, and brick quantities for small builds.' },
  { workspace: 'quick', slug: 'home-renovation', name: 'Home Renovation Budget', description: 'Track room-by-room renovation costs offline.' },
];

function activeNav(workspace) {
  return workspace === 'life' ? 'home' : workspace;
}

function workspaceIndexContent(workspace) {
  return `---
import WorkspaceDashboard from '../../../components/tools/WorkspaceDashboard.astro';
---

<WorkspaceDashboard workspaceId="${workspace}" />
`;
}

function toolPlaceholderContent(tool) {
  const nav = activeNav(tool.workspace);
  return `---
import ToolsLayout from '../../../layouts/ToolsLayout.astro';
import { formatSeoTitle } from '@shared/config/seo';

const toolName = ${JSON.stringify(tool.name)};
const toolDescription = ${JSON.stringify(tool.description)};
---

<ToolsLayout
  title={formatSeoTitle(toolName, 'Free Online Tool')}
  description={toolDescription}
  activeNav="${nav}"
>
  <h1 class="text-2xl font-bold text-white sm:text-3xl">{toolName}</h1>
</ToolsLayout>
`;
}

let created = 0;

for (const workspace of WORKSPACES) {
  const dir = path.join(pagesRoot, workspace);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.astro'), workspaceIndexContent(workspace));
  created++;
  console.log(`✓ ${workspace}/index.astro`);
}

for (const tool of TOOLS) {
  const dir = path.join(pagesRoot, tool.workspace);
  const file = path.join(dir, `${tool.slug}.astro`);
  writeFileSync(file, toolPlaceholderContent(tool));
  created++;
  console.log(`✓ ${tool.workspace}/${tool.slug}.astro`);
}

console.log(`\nScaffolded ${created} route files under apps/hub/src/pages/tools/`);
