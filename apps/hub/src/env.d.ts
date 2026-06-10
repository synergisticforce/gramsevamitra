/// <reference path="../.astro/types.d.ts" />
/// <reference types="@vite-pwa/astro/client" />

declare module '*?url' {
  const content: string;
  export default content;
}
