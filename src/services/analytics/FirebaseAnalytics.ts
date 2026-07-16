import analytics from '@react-native-firebase/analytics';

import type { UserId } from '@/types';

import type { AnalyticsProvider } from './AnalyticsProvider';

export const firebaseAnalytics: AnalyticsProvider = {
  track(event, properties) {
    analytics()
      .logEvent(event, properties)
      .catch(() => undefined); // non-fatal
  },

  identify(uid: UserId, traits) {
    void analytics().setUserId(uid);
    if (traits) {
      void analytics().setUserProperties(
        Object.fromEntries(Object.entries(traits).map(([k, v]) => [k, String(v)])),
      );
    }
  },

  screen(name) {
    analytics()
      .logScreenView({ screen_name: name, screen_class: name })
      .catch(() => undefined);
  },
};
