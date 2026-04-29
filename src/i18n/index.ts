import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';

import en from './en.json';
import fr from './fr.json';

/**
 * Best-effort device language detection without an extra dependency :
 *   - iOS  : NativeModules.SettingsManager.settings.AppleLocale (or AppleLanguages[0])
 *   - Android : NativeModules.I18nManager.localeIdentifier
 * Falls back to 'fr' on any failure.
 *
 * Settings screen (Phase 2) will let the user override this explicitly.
 */
function detectDeviceLanguage(): 'fr' | 'en' {
  try {
    const raw =
      Platform.OS === 'ios'
        ? (NativeModules.SettingsManager?.settings?.AppleLocale as string | undefined) ??
          (NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] as string | undefined)
        : (NativeModules.I18nManager?.localeIdentifier as string | undefined);
    const code = raw?.split(/[-_]/)[0]?.toLowerCase();
    return code === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

void i18n.use(initReactI18next).init({
  // Hermes (Expo Go on Android) lacks full Intl.PluralRules ; use v3 plural format
  // which works without the polyfill. Future EAS builds with full Intl support
  // can switch back to 'v4' if needed.
  compatibilityJSON: 'v3',
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
