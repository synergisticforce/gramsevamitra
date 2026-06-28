import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:cover-letter-generator';

interface FormState {
  userName: string;
  targetRole: string;
  targetCompany: string;
  keySkills: string;
  yearsExperience: string;
  highlight: string;
}

const DEFAULT_FORM: FormState = {
  userName: '',
  targetRole: '',
  targetCompany: '',
  keySkills: '',
  yearsExperience: '',
  highlight: '',
};

type TemplateId = 'cover' | 'linkedin' | 'cold';

function parseSkills(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

function skillsPhrase(skills: string[]): string {
  if (skills.length === 0) return '[your key skills]';
  if (skills.length === 1) return skills[0];
  if (skills.length === 2) return `${skills[0]} and ${skills[1]}`;
  return `${skills.slice(0, -1).join(', ')}, and ${skills[skills.length - 1]}`;
}

function val(raw: string, fallback: string): string {
  return raw.trim() || fallback;
}

function buildTemplates(state: FormState): Record<TemplateId, string> {
  const name = val(state.userName, '[Your Name]');
  const role = val(state.targetRole, '[Target Role]');
  const company = val(state.targetCompany, '[Target Company]');
  const skills = skillsPhrase(parseSkills(state.keySkills));
  const years = val(state.yearsExperience, '[X]');
  const highlight = val(state.highlight, 'delivering measurable outcomes for cross-functional teams');

  return {
    cover: `Dear Hiring Manager,

I am writing to express my interest in the ${role} position at ${company}. With ${years} years of experience in ${skills}, I am confident I can contribute from day one.

A recent highlight: ${highlight}. I am particularly drawn to ${company}'s mission and would welcome the opportunity to bring my expertise in ${skills} to your organization.

I have attached my resume for your review and would appreciate the chance to discuss how my background aligns with your needs.

Sincerely,
${name}`,
    linkedin: `Hi — I'm ${name}, exploring ${role} opportunities at ${company}. I admire the work your team is doing and would love to connect.

My background includes ${skills} (${years} years), with a focus on ${highlight}. If you're open to it, I'd appreciate any advice on ${role} roles at ${company}.

Thanks for considering my request!`,
    cold: `Subject: ${role} opportunity at ${company} — ${name}

Dear Hiring Manager,

My name is ${name}, and I am reaching out regarding the ${role} opening at ${company}. I specialize in ${skills} and have spent ${years} years ${highlight}.

I would value 15 minutes to share how I've applied ${skills} in past projects and learn more about your team's priorities. I've attached my resume for reference.

Would you be available for a brief call this week or next?

Best regards,
${name}`,
  };
}

export default function CoverLetterGenerator() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [copied, setCopied] = useState<TemplateId | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setForm({ ...DEFAULT_FORM, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const templates = useMemo(() => buildTemplates(form), [form]);

  const dynamicBlocks = useMemo(() => {
    const skills = parseSkills(form.keySkills);
    return [
      { key: 'role', label: 'Target role', value: form.targetRole || '—', filled: Boolean(form.targetRole.trim()) },
      { key: 'company', label: 'Company', value: form.targetCompany || '—', filled: Boolean(form.targetCompany.trim()) },
      { key: 'skills', label: 'Skills woven in', value: skills.length ? skills.join(', ') : '—', filled: skills.length > 0 },
      { key: 'years', label: 'Experience', value: form.yearsExperience ? `${form.yearsExperience} years` : '—', filled: Boolean(form.yearsExperience.trim()) },
    ];
  }, [form]);

  const copyTemplate = async (id: TemplateId) => {
    try {
      await navigator.clipboard.writeText(templates[id]);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const templateMeta: { id: TemplateId; title: string }[] = [
    { id: 'cover', title: 'Formal cover letter' },
    { id: 'linkedin', title: 'LinkedIn connection note' },
    { id: 'cold', title: 'Cold email to hiring manager' },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Your details</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Your name</span>
            <input value={form.userName} onChange={(e) => update({ userName: e.target.value })} className="input-field w-full" placeholder="e.g. Alex Morgan" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Target role</span>
            <input value={form.targetRole} onChange={(e) => update({ targetRole: e.target.value })} className="input-field w-full" placeholder="e.g. Product Manager" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Target company</span>
            <input value={form.targetCompany} onChange={(e) => update({ targetCompany: e.target.value })} className="input-field w-full" placeholder="e.g. Acme Corp" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Key skills (comma-separated)</span>
            <input value={form.keySkills} onChange={(e) => update({ keySkills: e.target.value })} className="input-field w-full" placeholder="SQL, stakeholder management, A/B testing" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Years of experience</span>
            <input value={form.yearsExperience} onChange={(e) => update({ yearsExperience: e.target.value })} className="input-field w-full" placeholder="e.g. 5" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Career highlight (one sentence)</span>
            <textarea rows={2} value={form.highlight} onChange={(e) => update({ highlight: e.target.value })} className="input-field w-full resize-y text-sm" placeholder="Led a project that increased conversion by 18%…" />
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-canvas-border bg-canvas-accent-soft/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Dynamic match blocks</p>
          <ul className="mt-3 space-y-2">
            {dynamicBlocks.map((block) => (
              <li key={block.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-canvas-subtle">{block.label}</span>
                <span className={`truncate font-medium ${block.filled ? 'text-canvas-accent' : 'text-canvas-muted'}`}>{block.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <button type="button" onClick={() => update(DEFAULT_FORM)} className="btn-secondary mt-4 w-full text-sm">Clear form</button>
      </section>

      <section className="space-y-4">
        {templateMeta.map(({ id, title }) => (
          <article key={id} className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/30 to-slate-900/60 p-4 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-canvas-text">{title}</h3>
              <button type="button" onClick={() => void copyTemplate(id)} className="btn-secondary px-3 py-1.5 text-xs">
                {copied === id ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/50 p-3 font-sans text-xs leading-relaxed text-canvas-muted">
              {templates[id]}
            </pre>
          </article>
        ))}
      </section>
    </div>
  );
}
