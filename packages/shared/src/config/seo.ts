import { SITES, type SiteKey } from './sites';

export interface PageSeo {
  title: string;
  description: string;
}

/** "Action Keyword + Tool Focus | GramSeva Mitra" */
export function formatSeoTitle(actionKeyword: string, toolFocus: string): string {
  return `${actionKeyword} ${toolFocus} | GramSeva Mitra`;
}

export function getRobotsDirective(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_ROBOTS) {
    return import.meta.env.PUBLIC_ROBOTS;
  }
  return 'index, follow';
}

export const SITE_HOME_SEO: Record<SiteKey, PageSeo> = {
  hub: {
    title: formatSeoTitle('Privacy-First Productivity Suite for', 'Global Professionals'),
    description:
      'Free document utilities, PDF editing, photo compression, and ATS resume checking — every feature runs privately in your browser with zero server uploads.',
  },
  optimizer: {
    title: formatSeoTitle('Photo & Signature Size Compressor', '(KB)'),
    description:
      'Crop and compress ID photos and form signatures under strict KB limits — resize documents locally without uploading to any server.',
  },
  resume: {
    title: formatSeoTitle('Free Visual ATS Resume Checker', 'Online'),
    description:
      'Compare your resume against any job description, spot missing keywords, and fix structural gaps — 100% private ATS analysis that never stores your CV on remote servers.',
  },
  pdf: {
    title: formatSeoTitle('Professional PDF Editor & Document Utilities', 'Online'),
    description:
      'Compress PDFs, merge documents, add watermarks, unlock protected files, and sign digitally — all processed locally in your browser.',
  },
};

export const LEGAL_SEO: Record<'privacy' | 'terms' | 'disclaimer', Record<SiteKey, PageSeo>> = {
  privacy: {
    hub: {
      title: 'Privacy Policy | GramSeva Mitra',
      description:
        'GramSeva Mitra processes every file in your browser via sandboxed Web Workers. No uploads, no cloud storage, GDPR and CCPA aligned zero-data retention.',
    },
    optimizer: {
      title: 'Privacy Policy — Document Optimizer | GramSeva Mitra',
      description:
        'Exam photos and signatures are resized entirely on your device. Files never leave your browser; learn how GramSeva Mitra protects your identity documents.',
    },
    resume: {
      title: 'Privacy Policy — Resume Scanner | GramSeva Mitra',
      description:
        'Resume and job-description text stay on your device during ATS analysis. No server-side storage, no third-party tracking cookies.',
    },
    pdf: {
      title: 'Privacy Policy — PDF Tools | GramSeva Mitra',
      description:
        'PDF compression, signing, cropping, and encryption run in sandboxed Web Workers on your device. Your documents are never uploaded.',
    },
  },
  terms: {
    hub: {
      title: 'Terms of Service | GramSeva Mitra',
      description:
        'GramSeva Mitra utilities are provided as-is. You retain full ownership and liability for all documents you process.',
    },
    optimizer: {
      title: 'Terms of Service — Document Optimizer | GramSeva Mitra',
      description:
        'Use the Document Optimizer at your own discretion. Results are indicative; verify final file sizes and dimensions against official requirements.',
    },
    resume: {
      title: 'Terms of Service — Resume Scanner | GramSeva Mitra',
      description:
        'ATS scores are guidance only and do not guarantee interview shortlisting. You are responsible for the accuracy of resume content you submit for analysis.',
    },
    pdf: {
      title: 'Terms of Service — PDF Tools | GramSeva Mitra',
      description:
        'PDF utilities are provided as-is without uptime guarantees. You are solely responsible for encrypted documents and files you process locally.',
    },
  },
  disclaimer: {
    hub: {
      title: 'Disclaimer | GramSeva Mitra',
      description:
        'Limitation of liability for financial, health, legal, and AI-generated outputs on GramSeva Mitra free and Pro tools.',
    },
    optimizer: {
      title: 'Disclaimer — Document Optimizer | GramSeva Mitra',
      description:
        'Exam photo and signature sizing results are indicative. Verify dimensions against official notification requirements.',
    },
    resume: {
      title: 'Disclaimer — Resume Scanner | GramSeva Mitra',
      description:
        'ATS match scores are educational estimates only and do not guarantee hiring outcomes.',
    },
    pdf: {
      title: 'Disclaimer — PDF Tools | GramSeva Mitra',
      description:
        'PDF editing and security tools are provided without warranty. Review every output before official submission.',
    },
  },
};

export function canonicalUrl(site: SiteKey, pathname: string): string {
  return new URL(pathname, SITES[site].url).href;
}
