export const SITES = {
  hub: {
    name: 'GramSeva Mitra',
    url: 'https://gramsevamitra.com',
    domain: 'gramsevamitra.com',
  },
  optimizer: {
    name: 'Government Exam Document Optimizer',
    url: 'https://optimizer.gramsevamitra.com',
    domain: 'optimizer.gramsevamitra.com',
    shortName: 'Doc Optimizer',
  },
  resume: {
    name: 'ATS Resume Scanner',
    url: 'https://resume.gramsevamitra.com',
    domain: 'resume.gramsevamitra.com',
    shortName: 'Resume Scanner',
  },
  pdf: {
    name: 'PDF Tools',
    url: 'https://pdf.gramsevamitra.com',
    domain: 'pdf.gramsevamitra.com',
    shortName: 'PDF Tools',
  },
} as const;

export type SiteKey = keyof typeof SITES;
