/// <reference path="../.astro/types.d.ts" />
/// <reference types="@vite-pwa/astro/client" />

declare module '*?url' {
  const content: string;
  export default content;
}

declare module 'sortablejs' {
  interface SortableOptions {
    group?: string | { name: string; pull?: boolean; put?: boolean };
    animation?: number;
    delay?: number;
    delayOnTouchOnly?: boolean;
    ghostClass?: string;
    handle?: string;
    onEnd?: () => void;
  }
  export default class Sortable {
    static create(el: HTMLElement, options?: SortableOptions): Sortable;
    destroy(): void;
  }
}
