import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uvalarm.app',
  appName: 'UV Alarm',
  webDir: 'dist',
  backgroundColor: '#0b1220',
  android: { backgroundColor: '#0b1220', allowMixedContent: false },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#0b1220',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
    },
    LocalNotifications: { smallIcon: 'ic_stat_uv_alarm', iconColor: '#F59E0B', sound: 'default' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
