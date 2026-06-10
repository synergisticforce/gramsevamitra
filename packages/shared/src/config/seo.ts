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
    title: formatSeoTitle('Digital Empowerment Suite for', 'Indian Aspirants'),
    description:
      'Free exam document utilities, PDF editing, photo compression, and ATS resume checking — every feature runs privately in your browser with zero server uploads.',
  },
  optimizer: {
    title: formatSeoTitle('Photo & Signature Size Compressor', '(KB)'),
    description:
      'Crop and compress exam photos and form signatures under strict KB limits for SSC, UPSC, RRB, and IBPS — resize certificates locally without uploading to any server.',
  },
  resume: {
    title: formatSeoTitle('Free Visual ATS Resume Checker', 'Online'),
    description:
      'Compare your resume against any job description, spot missing keywords, and fix structural gaps — 100% private ATS analysis that never stores your CV on remote servers.',
  },
  pdf: {
    title: formatSeoTitle('Visual PDF Editor & Document Utilities', 'Online'),
    description:
      'Compress certificates under 50KB, crop form signatures, merge exam PDFs, add watermarks, unlock protected statements, and sign documents — all processed locally in your browser.',
  },
};

export const LEGAL_SEO: Record<'privacy' | 'terms', Record<SiteKey, PageSeo>> = {
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
        'PDF compression, signing, cropping, and encryption run in sandboxed Web Workers on your device. Your exam documents and certificates are never uploaded.',
    },
  },
  terms: {
    hub: {
      title: 'Terms of Service | GramSeva Mitra',
      description:
        'GramSeva Mitra utilities are provided as-is. You retain full ownership and liability for all documents you process, including identity certificates and exam forms.',
    },
    optimizer: {
      title: 'Terms of Service — Document Optimizer | GramSeva Mitra',
      description:
        'Use the Document Optimizer at your own discretion. Results are indicative; verify final file sizes and dimensions against official exam notification guidelines.',
    },
    resume: {
      title: 'Terms of Service — Resume Scanner | GramSeva Mitra',
      description:
        'ATS scores are guidance only and do not guarantee interview shortlisting. You are responsible for the accuracy of resume content you submit for analysis.',
    },
    pdf: {
      title: 'Terms of Service — PDF Tools | GramSeva Mitra',
      description:
        'PDF utilities are provided as-is without uptime guarantees. You are solely responsible for encrypted documents, passport scans, and exam PDFs you process locally.',
    },
  },
};

export function canonicalUrl(site: SiteKey, pathname: string): string {
  return new URL(pathname, SITES[site].url).href;
}
