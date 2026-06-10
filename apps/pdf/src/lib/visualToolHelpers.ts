import { createInitialPageStates, type PageVisualState } from './visualPageTypes';

export function buildPageOrder(numPages: number): number[] {
  return Array.from({ length: numPages }, (_, i) => i + 1);
}

export function initVisualPageState(numPages: number): {
  pageStates: PageVisualState[];
  pageOrder: number[];
} {
  return {
    pageStates: createInitialPageStates(numPages),
    pageOrder: buildPageOrder(numPages),
  };
}
