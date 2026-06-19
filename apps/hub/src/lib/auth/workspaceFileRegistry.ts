/** Lets billing/auth flows capture the active Document Studio file before redirect. */

let activeFileProvider: (() => File | null) | null = null;

export function registerWorkspaceFileProvider(provider: () => File | null): () => void {
  activeFileProvider = provider;
  return () => {
    if (activeFileProvider === provider) {
      activeFileProvider = null;
    }
  };
}

export function getActiveWorkspaceFile(): File | null {
  return activeFileProvider?.() ?? null;
}
