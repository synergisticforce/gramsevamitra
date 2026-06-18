/** Master catalog for the Utilities Hub — every route under `/tools/*`. */
export type ToolWorkspace = 'money' | 'writing' | 'career' | 'life' | 'quick';

export interface WorkspaceMeta {
  id: ToolWorkspace;
  label: string;
  emoji: string;
  description: string;
  path: string;
}

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  workspace: ToolWorkspace;
  keywords: string[];
  aliases?: string[];
}

export const WORKSPACES: WorkspaceMeta[] = [
  {
    id: 'money',
    label: 'Money & Gig Ledger',
    emoji: '💰',
    description: 'Track daily income, budgets, EMIs, invoices, and gig earnings — all offline.',
    path: '/tools/money',
  },
  {
    id: 'writing',
    label: 'Smart Writing Studio',
    emoji: '✍️',
    description: 'Markdown editor, citations, flashcards, and speech tools for students and writers.',
    path: '/tools/writing',
  },
  {
    id: 'career',
    label: 'Career Prep Room',
    emoji: '🚀',
    description: 'Resume bullets, job tracker, cover letters, and legal templates for job seekers.',
    path: '/tools/career',
  },
  {
    id: 'life',
    label: 'Life & Focus Tracker',
    emoji: '🧘',
    description: 'Pomodoro, habits, health calculators, and private offline wellness trackers.',
    path: '/tools/life',
  },
  {
    id: 'quick',
    label: 'Quick Tools Drawer',
    emoji: '🧰',
    description: 'QR codes, unit converters, passwords, and dozens of single-tap utilities.',
    path: '/tools/quick',
  },
];

export const TOOLS_REGISTRY: ToolEntry[] = [
  {
    id: 'utilities-hub',
    name: 'Utilities Super-App',
    description: 'Browse all offline workspaces — money, writing, career, wellness, and quick tools.',
    path: '/tools',
    workspace: 'quick',
    keywords: ['utilities', 'tools hub', 'super app', 'offline tools', 'gramseva'],
    aliases: ['tools home', 'all tools'],
  },
  // Money & Gig Ledger
  {
    id: 'money-dashboard',
    name: 'Money Dashboard',
    description: 'Gig income tracker, envelope budget, fuel efficiency, and subscription analyzer.',
    path: '/tools/money',
    workspace: 'money',
    keywords: ['gig', 'budget', 'income', 'ledger', 'fuel', 'subscription'],
    aliases: ['money home', 'finance dashboard'],
  },
  {
    id: 'emi-calculator',
    name: 'EMI Calculator',
    description: 'Calculate monthly loan EMI with principal, rate, and tenure.',
    path: '/tools/money/emi-calculator',
    workspace: 'money',
    keywords: ['emi', 'loan', 'monthly', 'installment', 'home loan'],
  },
  {
    id: 'sip-calculator',
    name: 'SIP Calculator',
    description: 'Estimate mutual fund SIP maturity value, invested amount, and wealth gained.',
    path: '/tools/money/sip-calculator',
    workspace: 'money',
    keywords: ['sip', 'mutual fund', 'investment', 'returns', 'monthly'],
  },
  {
    id: 'gst-calculator',
    name: 'GST Calculator',
    description: 'Add or remove Indian GST with CGST and SGST breakdown for 5%, 12%, 18%, and 28% slabs.',
    path: '/tools/money/gst-calculator',
    workspace: 'money',
    keywords: ['gst', 'cgst', 'sgst', 'tax', 'invoice', 'india'],
  },
  {
    id: 'discount-calculator',
    name: 'Discount & Margin Calculator',
    description: 'Calculate final price after percentage or flat discount plus optional sales tax.',
    path: '/tools/money/discount-calculator',
    workspace: 'money',
    keywords: ['discount', 'sale', 'margin', 'tax', 'final price', 'shopping'],
    aliases: ['discount calculator', 'sale price'],
  },
  {
    id: 'loan-repayment',
    name: 'Loan Repayment Planner',
    description: 'Plan prepayments and see amortization schedules offline.',
    path: '/tools/money/loan-repayment',
    workspace: 'money',
    keywords: ['repayment', 'amortization', 'prepay', 'loan schedule'],
  },
  {
    id: 'tip-calculator',
    name: 'Tip & Split Calculator',
    description: 'Split restaurant bills and calculate tips per person with adjustable percentages.',
    path: '/tools/money/tip-calculator',
    workspace: 'money',
    keywords: ['tip', 'split bill', 'restaurant', 'gratuity', 'per person'],
  },
  {
    id: 'multi-currency',
    name: 'Multi-Currency Converter',
    description: 'Convert amounts using live Frankfurter exchange rates — cached locally for 12 hours.',
    path: '/tools/money/multi-currency',
    workspace: 'money',
    keywords: ['currency', 'forex', 'dollar', 'rupee', 'exchange'],
  },
  {
    id: 'invoice-builder',
    name: 'Invoice Builder',
    description: 'Create client invoices and export as PDF in your browser.',
    path: '/tools/money/invoice-builder',
    workspace: 'money',
    keywords: ['invoice', 'bill', 'freelance', 'pdf'],
  },
  {
    id: 'pay-stub-generator',
    name: 'Pay Stub Generator',
    description: 'Generate simple salary pay stubs for records.',
    path: '/tools/money/pay-stub-generator',
    workspace: 'money',
    keywords: ['pay stub', 'salary slip', 'payslip'],
  },
  {
    id: 'meeting-cost',
    name: 'Meeting Cost Calculator',
    description: 'Estimate the rupee cost of meetings by attendee salary.',
    path: '/tools/money/meeting-cost',
    workspace: 'money',
    keywords: ['meeting', 'cost', 'productivity', 'time'],
  },
  {
    id: 'tax-deduction-tracker',
    name: 'Tax Deduction Tracker',
    description: 'Log deductible expenses for year-end tax planning.',
    path: '/tools/money/tax-deduction-tracker',
    workspace: 'money',
    keywords: ['tax', 'deduction', '80c', 'expense', 'itr'],
  },
  {
    id: 'crypto-tax',
    name: 'Crypto Capital Gains',
    description: 'Simple offline capital gains calculator for crypto trades.',
    path: '/tools/money/crypto-tax',
    workspace: 'money',
    keywords: ['crypto', 'bitcoin', 'capital gains', 'trading'],
  },
  // Smart Writing Studio
  {
    id: 'writing-dashboard',
    name: 'Writing Studio',
    description: 'Markdown editor with live word count and readability score.',
    path: '/tools/writing',
    workspace: 'writing',
    keywords: ['markdown', 'editor', 'word count', 'readability'],
    aliases: ['write', 'notes'],
  },
  {
    id: 'handwriting-converter',
    name: 'Handwriting Converter',
    description: 'Turn typed text into a handwritten-style image export.',
    path: '/tools/writing/handwriting-converter',
    workspace: 'writing',
    keywords: ['handwriting', 'script', 'image', 'notes'],
  },
  {
    id: 'speech-to-text',
    name: 'Speech to Text',
    description: 'Dictate notes using the Web Speech API — fully local.',
    path: '/tools/writing/speech-to-text',
    workspace: 'writing',
    keywords: ['speech', 'dictation', 'voice', 'transcribe'],
  },
  {
    id: 'text-to-speech',
    name: 'Text to Speech',
    description: 'Listen to your drafts with browser Speech Synthesis.',
    path: '/tools/writing/text-to-speech',
    workspace: 'writing',
    keywords: ['tts', 'read aloud', 'audio', 'listen'],
  },
  {
    id: 'citation-generator',
    name: 'Citation Generator',
    description: 'Format references in APA, MLA, and Chicago styles.',
    path: '/tools/writing/citation-generator',
    workspace: 'writing',
    keywords: ['citation', 'apa', 'mla', 'bibliography', 'reference'],
  },
  {
    id: 'plagiarism-checker',
    name: 'Plagiarism Checker',
    description: 'Compare two texts with client-side diff analysis.',
    path: '/tools/writing/plagiarism-checker',
    workspace: 'writing',
    keywords: ['plagiarism', 'similarity', 'compare text', 'diff'],
  },
  {
    id: 'ocr-extractor',
    name: 'Browser OCR Text Extractor',
    description: 'Extract text from images using ONNX WASM (TrOCR) with Canvas preprocessing and Web Worker inference.',
    path: '/tools/writing/ocr-extractor',
    workspace: 'writing',
    keywords: ['ocr', 'scan', 'text extract', 'image to text', 'onnx', 'wasm', 'optical character'],
    aliases: ['ocr', 'image ocr', 'scan text'],
  },
  {
    id: 'word-counter',
    name: 'Word & Character Counter',
    description: 'Count words, characters, sentences, paragraphs, and reading time in real time.',
    path: '/tools/writing/word-counter',
    workspace: 'writing',
    keywords: ['word count', 'character count', 'reading time', 'essay', 'text stats', 'paragraph'],
    aliases: ['word counter', 'char count', 'letter count', 'character counter'],
  },
  {
    id: 'case-converter',
    name: 'Case Converter',
    description: 'Convert text to uppercase, lowercase, title case, sentence case, or alternating case.',
    path: '/tools/writing/case-converter',
    workspace: 'writing',
    keywords: ['case', 'uppercase', 'lowercase', 'title case', 'sentence case', 'text transform'],
    aliases: ['text case', 'capitalize'],
  },
  {
    id: 'gpa-calculator',
    name: 'GPA / SGPA Calculator',
    description: 'Compute semester SGPA and CGPA from credits and Indian 10-point letter grades.',
    path: '/tools/writing/gpa-calculator',
    workspace: 'writing',
    keywords: ['gpa', 'cgpa', 'sgpa', 'grades', 'college', 'marks', 'semester', 'credits'],
    aliases: ['grade calculator', 'university gpa', '10 point scale'],
  },
  {
    id: 'flashcard-maker',
    name: 'Flashcard Maker',
    description: 'Highlight text and save cards to a local study deck.',
    path: '/tools/writing/flashcard-maker',
    workspace: 'writing',
    keywords: ['flashcard', 'study', 'revision', 'deck'],
  },
  {
    id: 'flashcard-generator',
    name: 'Flashcard Generator',
    description: 'Paste Question-Answer lines and study with interactive flip cards.',
    path: '/tools/writing/flashcard-generator',
    workspace: 'writing',
    keywords: ['flashcard', 'generator', 'study', 'flip card', 'notes', 'revision'],
    aliases: ['flash cards', 'study cards'],
  },
  {
    id: 'mindmap-builder',
    name: 'Mind Map Builder',
    description: 'Visual canvas for brainstorming and topic maps.',
    path: '/tools/writing/mindmap-builder',
    workspace: 'writing',
    keywords: ['mind map', 'brainstorm', 'diagram', 'canvas'],
  },
  {
    id: 'phonetic-alphabet',
    name: 'Phonetic Alphabet (IPA)',
    description: 'Convert words to IPA phonetic notation.',
    path: '/tools/writing/phonetic-alphabet',
    workspace: 'writing',
    keywords: ['ipa', 'phonetic', 'pronunciation', 'english'],
  },
  // Career Prep Room
  {
    id: 'career-dashboard',
    name: 'Career Prep Dashboard',
    description: 'Job hunt overview, ATS scanning, cover letters, and AI resume helpers.',
    path: '/tools/career',
    workspace: 'career',
    keywords: ['resume', 'cover letter', 'linkedin', 'job hunt', 'career'],
    aliases: ['career home', 'job prep'],
  },
  {
    id: 'job-tracker',
    name: 'Job Application Tracker',
    description: 'Offline Kanban board for tracking job applications.',
    path: '/tools/quick-tools/job-tracker',
    workspace: 'quick-tools',
    keywords: ['job tracker', 'kanban', 'applications', 'hiring'],
  },
  {
    id: 'salary-calculator',
    name: 'Salary & Take-Home Calculator',
    description: 'Estimate monthly in-hand pay from annual CTC with standard EPF deductions.',
    path: '/tools/finance/salary-calculator',
    workspace: 'finance',
    keywords: ['salary', 'ctc', 'take home', 'epf', 'in-hand'],
  },
  {
    id: 'cold-email',
    name: 'Cold Email & Networking Builder',
    description: 'Generate cover letters, LinkedIn notes, and cold emails from your job-hunt details.',
    path: '/tools/quick-tools/cold-email',
    workspace: 'quick-tools',
    keywords: ['cold email', 'cover letter', 'linkedin', 'networking', 'outreach'],
  },
  {
    id: 'business-card',
    name: 'Business Card Generator',
    description: 'Create downloadable vCard contact files.',
    path: '/tools/career/business-card',
    workspace: 'career',
    keywords: ['vcard', 'business card', 'contact', 'networking'],
  },
  {
    id: 'salary-benchmarking',
    name: 'Salary Benchmarking',
    description: 'Look up indicative salary ranges from static offline data.',
    path: '/tools/finance/salary-benchmarking',
    workspace: 'finance',
    keywords: ['salary', 'ctc', 'pay scale', 'benchmark'],
  },
  {
    id: 'skill-gap',
    name: 'Skill Gap Analyzer',
    description: 'Compare your skills against a target job description.',
    path: '/tools/career/skill-gap',
    workspace: 'career',
    keywords: ['skill gap', 'upskill', 'job description', 'match'],
  },
  {
    id: 'legal-templates',
    name: 'Legal Templates',
    description: 'Fill-in-the-blank NDAs, rental agreements, and more.',
    path: '/tools/career/legal-templates',
    workspace: 'career',
    keywords: ['nda', 'rental agreement', 'legal', 'contract', 'template'],
  },
  {
    id: 'typing-speed-test',
    name: 'Typing Speed Test',
    description: '60-second typing test with live WPM and accuracy — ideal for exam and job typing prep.',
    path: '/tools/career/typing-speed-test',
    workspace: 'career',
    keywords: ['typing', 'wpm', 'speed test', 'accuracy', 'keyboard', 'exam typing'],
    aliases: ['typing test', 'words per minute'],
  },
  {
    id: 'ats-keyword-matcher',
    name: 'ATS Resume Keyword Matcher',
    description: 'Match resume text against job descriptions with fuzzy keyword analysis and missing-term lists.',
    path: '/tools/career/ats-keyword-matcher',
    workspace: 'career',
    keywords: ['ats', 'resume keywords', 'job description', 'match score', 'missing keywords', 'applicant tracking'],
    aliases: ['keyword matcher', 'resume match', 'ats score'],
  },
  // Life & Focus Tracker
  {
    id: 'life-dashboard',
    name: 'Life & Focus Dashboard',
    description: 'Pomodoro, habits, water intake, stretching, and medication reminders.',
    path: '/tools/life',
    workspace: 'life',
    keywords: ['pomodoro', 'habit', 'focus', 'water', 'medication'],
    aliases: ['wellness', 'life home'],
  },
  {
    id: 'event-countdown',
    name: 'Event Countdown',
    description: 'Save multiple countdown timers with live day/hour/minute/second updates for exams and milestones.',
    path: '/tools/life/event-countdown',
    workspace: 'life',
    keywords: ['countdown', 'exam date', 'birthday', 'timer', 'deadline'],
  },
  {
    id: 'bmi-calculator',
    name: 'BMI Calculator',
    description: 'Calculate Body Mass Index from height and weight.',
    path: '/tools/life/bmi-calculator',
    workspace: 'life',
    keywords: ['bmi', 'weight', 'height', 'health'],
  },
  {
    id: 'body-fat',
    name: 'Body Fat Calculator',
    description: 'Estimate body fat % using the U.S. Navy Method with metric/imperial units and color-coded categories.',
    path: '/tools/life/body-fat',
    workspace: 'life',
    keywords: ['body fat', 'navy method', 'fitness', 'health', 'waist', 'neck'],
  },
  {
    id: 'age-calculator',
    name: 'Age & Date Calculator',
    description: 'Calculate exact age in years, months, days, total days lived, and birth weekday.',
    path: '/tools/life/age-calculator',
    workspace: 'life',
    keywords: ['age', 'birthday', 'date difference', 'how old', 'days lived'],
    aliases: ['age calculator', 'dob calculator'],
  },
  {
    id: 'exam-age-eligibility',
    name: 'Exam Age Eligibility Calculator',
    description: 'Calculate age as of an application cutoff date with common presets and eligible / not eligible banner.',
    path: '/tools/life/exam-age-eligibility',
    workspace: 'life',
    keywords: ['exam age', 'age limit', 'cutoff date', 'eligibility', 'application deadline'],
    aliases: ['age eligibility', 'exam eligibility'],
  },
  {
    id: 'menstrual-tracker',
    name: 'Menstrual & Ovulation Calculator',
    description: 'Estimate next period, ovulation window, and fertile timeline from cycle length — fully offline.',
    path: '/tools/life/menstrual-tracker',
    workspace: 'life',
    keywords: ['period', 'cycle', 'menstrual', 'ovulation', 'fertile window', 'private'],
    aliases: ['period tracker', 'fertility calculator'],
  },
  {
    id: 'mood-tracker',
    name: 'Mood & Daily Log',
    description: 'Daily mood check-in with emoji scale and brief notes — one entry per day, fully offline.',
    path: '/tools/life/mood-tracker',
    workspace: 'life',
    keywords: ['mood', 'mental health', 'journal', 'feelings', 'daily log'],
  },
  {
    id: 'macro-calculator',
    name: 'Macro & Calorie Calculator',
    description: 'Daily calories and macro split using Mifflin-St Jeor — protein, fat, and carbs for cut, maintain, or bulk.',
    path: '/tools/life/macro-calculator',
    workspace: 'life',
    keywords: ['macro', 'calories', 'protein', 'diet', 'tdee', 'bmr', 'nutrition', 'fitness'],
    aliases: ['calorie calculator', 'macro calculator'],
  },
  // Quick Tools Drawer
  {
    id: 'quick-dashboard',
    name: 'Quick Tools Drawer',
    description: 'Fast single-action utilities — QR codes, converters, passwords, and more.',
    path: '/tools/quick',
    workspace: 'quick',
    keywords: ['quick tools', 'utilities drawer', 'fast tools'],
    aliases: ['quick home'],
  },
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Custom colors, error correction levels, and high-res PNG QR export offline.',
    path: '/tools/quick/qr-generator',
    workspace: 'quick',
    keywords: ['qr', 'barcode', 'scan', 'link'],
  },
  {
    id: 'exam-photo-studio',
    name: 'Exam Photo & Signature Studio',
    description: 'Crop and compress passport photos and signatures for visa applications and professional form uploads.',
    path: '/tools/quick/exam-photo-studio',
    workspace: 'quick',
    keywords: ['exam photo', 'passport photo', 'signature', 'id photo', 'visa photo', 'compress', '50kb'],
    aliases: ['photo compressor', 'exam upload', 'document photo'],
  },
  {
    id: 'document-redactor',
    name: 'Secure Document Redactor',
    description: 'Draw permanent black redaction boxes on images or PDF pages and export flattened PNG.',
    path: '/tools/quick/document-redactor',
    workspace: 'quick',
    keywords: ['redact', 'privacy', 'blackout', 'pii', 'censor', 'document', 'secure'],
    aliases: ['redaction tool', 'document privacy'],
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert length, weight, temperature, and more.',
    path: '/tools/quick/unit-converter',
    workspace: 'quick',
    keywords: ['unit', 'convert', 'metric', 'imperial'],
  },
  {
    id: 'percentage-calculator',
    name: 'Percentage Calculator',
    description: 'What is X% of Y, ratio to percent, and percent increase/decrease — instant results.',
    path: '/tools/quick/percentage-calculator',
    workspace: 'quick',
    keywords: ['percent', 'percentage', 'ratio', 'change', 'math', 'discount'],
    aliases: ['percent calculator'],
  },
  {
    id: 'scientific-calculator',
    name: 'Scientific Calculator',
    description: 'Trig, log, powers, and calculation history in a mobile-friendly grid layout.',
    path: '/tools/quick/scientific-calculator',
    workspace: 'quick',
    keywords: ['calculator', 'scientific', 'sin', 'cos', 'math', 'trigonometry'],
    aliases: ['sci calc'],
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    description: 'Cryptographically secure passwords with length 8–128 and custom character sets.',
    path: '/tools/quick/password-generator',
    workspace: 'quick',
    keywords: ['password', 'secure', 'random', 'strong'],
  },
  {
    id: 'random-number',
    name: 'Random Number Generator',
    description: 'Generate random integers in a custom range with sort and copy — fully offline.',
    path: '/tools/quick/random-number',
    workspace: 'quick',
    keywords: ['random', 'number', 'integer', 'lottery', 'dice', 'range'],
    aliases: ['rng', 'random picker'],
  },
  {
    id: 'base64',
    name: 'Base64 Encoder / Decoder',
    description: 'Encode and decode UTF-8 text to Base64 with native btoa/atob and safe error handling.',
    path: '/tools/quick/base64',
    workspace: 'quick',
    keywords: ['base64', 'encode', 'decode', 'btoa', 'atob', 'string'],
    aliases: ['base 64', 'b64'],
  },
  {
    id: 'url-encoder',
    name: 'URL Encoder / Decoder',
    description: 'Percent-encode and decode URLs and query strings with encodeURIComponent.',
    path: '/tools/quick/url-encoder',
    workspace: 'quick',
    keywords: ['url', 'encode', 'decode', 'uri', 'percent encoding', 'query string'],
    aliases: ['url encode', 'percent encode'],
  },
  {
    id: 'hash-generator',
    name: 'Crypto Hash Generator',
    description: 'Real-time MD5, SHA-1, SHA-256, and SHA-512 digests — Web Crypto API, fully offline.',
    path: '/tools/quick/hash-generator',
    workspace: 'quick',
    keywords: ['hash', 'md5', 'sha1', 'sha256', 'checksum', 'digest', 'crypto'],
    aliases: ['checksum', 'sha-256', 'sha-1'],
  },
  {
    id: 'format-converter',
    name: 'Format Converter',
    description: 'Bidirectional JSON, CSV, and XML conversion with validation and beautify/minify — offline.',
    path: '/tools/dev/format-converter',
    workspace: 'quick',
    keywords: ['csv', 'json', 'xml', 'format', 'convert', 'developer'],
    aliases: ['quick format converter', 'code beautify'],
  },
  {
    id: 'color-palette',
    name: 'Color Palette Generator',
    description: 'Extract dominant colors from images or generate harmonized palettes with HEX/RGB export.',
    path: '/tools/design/color-palette',
    workspace: 'quick',
    keywords: ['color', 'palette', 'hex', 'design', 'coolors', 'extract'],
    aliases: ['quick color palette'],
  },
  {
    id: 'baby-names',
    name: 'Baby Name Finder',
    description: 'Browse diverse baby names by origin, letter, and gender — shortlist saved offline.',
    path: '/tools/quick/baby-names',
    workspace: 'quick',
    keywords: ['baby name', 'names', 'newborn'],
  },
  {
    id: 'decision-wheel',
    name: 'Decision Wheel',
    description: 'Physics-based canvas spinner with weighted segments and confetti celebration.',
    path: '/tools/fun/decision-wheel',
    workspace: 'quick',
    keywords: ['wheel', 'random', 'decide', 'spin', 'picker'],
    aliases: ['quick decision wheel'],
  },
  {
    id: 'seo-meta',
    name: 'SEO Meta Tag Studio',
    description: 'Google SERP and social card previews with character/pixel compliance meters.',
    path: '/tools/business/seo-meta',
    workspace: 'quick',
    keywords: ['seo', 'meta tags', 'og', 'twitter card', 'serp', 'moz'],
    aliases: ['seo meta tags', 'quick seo meta tags'],
  },
  {
    id: 'recipe-scaler',
    name: 'Recipe Scaler',
    description: 'Scale ingredient quantities up or down for any serving size.',
    path: '/tools/quick/recipe-scaler',
    workspace: 'quick',
    keywords: ['recipe', 'cooking', 'ingredients', 'scale'],
  },
  {
    id: 'pet-feeding',
    name: 'Pet Feeding Scheduler',
    description: 'Plan pet meal times and portions locally.',
    path: '/tools/quick/pet-feeding',
    workspace: 'quick',
    keywords: ['pet', 'dog', 'cat', 'feeding', 'schedule'],
  },
  {
    id: 'gardening-planner',
    name: 'Gardening Planner',
    description: 'Plan sowing and watering schedules for home gardens.',
    path: '/tools/quick/gardening-planner',
    workspace: 'quick',
    keywords: ['garden', 'plants', 'sowing', 'watering'],
  },
  {
    id: 'construction-materials',
    name: 'Construction Materials Estimator',
    description: 'Estimate cement, sand, and brick quantities for small builds.',
    path: '/tools/quick/construction-materials',
    workspace: 'quick',
    keywords: ['construction', 'cement', 'bricks', 'estimate'],
  },
  {
    id: 'home-renovation',
    name: 'Home Renovation Budget',
    description: 'Track room-by-room renovation costs offline.',
    path: '/tools/quick/home-renovation',
    workspace: 'quick',
    keywords: ['renovation', 'home', 'budget', 'interior'],
  },
];

/** Phase 1 homepage intent cards — primary workspaces for students, gig workers, and job seekers. */
export const INTENT_WORKSPACES: WorkspaceMeta[] = WORKSPACES.filter((w) =>
  (['money', 'writing', 'career'] as ToolWorkspace[]).includes(w.id)
);

export function getWorkspaceMeta(id: ToolWorkspace): WorkspaceMeta {
  const workspace = WORKSPACES.find((w) => w.id === id);
  if (!workspace) throw new Error(`Unknown workspace: ${id}`);
  return workspace;
}

/** Micro-tools only — excludes the workspace dashboard route (`/tools/{workspace}`). */
export function getWorkspaceTools(workspace: ToolWorkspace): ToolEntry[] {
  const prefix = `/tools/${workspace}/`;
  return TOOLS_REGISTRY.filter((t) => t.workspace === workspace && t.path.startsWith(prefix));
}

export type ToolsLayoutNav = 'home' | 'money' | 'writing' | 'career' | 'life' | 'quick';

export function activeNavForWorkspace(workspace: ToolWorkspace): ToolsLayoutNav {
  if (workspace === 'life') return 'life';
  return workspace;
}

export function filterTools(query: string): ToolEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return TOOLS_REGISTRY.filter((tool) => {
    const matchName = tool.name.toLowerCase().includes(q);
    const matchDesc = tool.description.toLowerCase().includes(q);
    const matchKeywords = tool.keywords.some((kw) => kw.toLowerCase().includes(q));
    const matchAlias = tool.aliases?.some((alias) => alias.toLowerCase().includes(q));
    return matchName || matchDesc || matchKeywords || matchAlias;
  });
}
