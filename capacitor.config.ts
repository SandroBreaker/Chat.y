import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amourmessage.app',
  appName: 'Amour Message',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;