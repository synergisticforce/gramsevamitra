import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gramsevamitra.app',
  appName: 'GramSeva Mitra',
  webDir: 'apps/hub/dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // ML Kit Document Scanner is registered via @capacitor-mlkit/document-scanner
  },
};

export default config;
