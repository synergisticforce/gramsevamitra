export const SITES = {
  hub: {
    name: 'GramSeva Mitra',
    url: 'https://gramsevamitra.com',
    domain: 'gramsevamitra.com',
  },
  utilities: {
    name: 'GramSeva Mitra Utilities',
    url: 'https://utilities.gramsevamitra.com',
    domain: 'utilities.gramsevamitra.com',
    shortName: 'Utilities',
  },
  optimizer: {
    name: 'Document Photo Optimizer',
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

export type SiteKey = 'hub' | 'optimizer' | 'resume' | 'pdf';

/** Absolute URL for a hub app route (e.g. `/workspace/documents`). */
export function utilitiesHref(path = '/workspace/documents'): string {
  return new URL(path, SITES.utilities.url).href;
}

/** Absolute URL for any GramSeva property route. */
export function siteHref(site: SiteKey, path = '/'): string {
  return new URL(path, SITES[site].url).href;
}
