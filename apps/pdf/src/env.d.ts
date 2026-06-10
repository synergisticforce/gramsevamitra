/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module '*?url' {
  const content: string;
  export default content;
}

declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const url: string;
  export default url;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs?url' {
  const url: string;
  export default url;
}
