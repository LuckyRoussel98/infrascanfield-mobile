import * as Haptics from 'expo-haptics';

import { logger } from './logger';

/**
 * Tiny, opinionated haptics layer.
 * - All calls are fire-and-forget — never throw, never block.
 * - On platforms / devices without haptic engine the underlying call is a no-op.
 * Use these names to keep call sites consistent across the app.
 */

export const haptic = {
  /** Tap on a non-destructive button, list row, tab change. */
  tap: () => safe(() => Haptics.selectionAsync()),
  /** Capture / commit / scroll-to-top. Slightly stronger than tap. */
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Confirmation of a meaningful action (e.g. file uploaded). */
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Success notification (upload sent, login OK). */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Warning notification (offline fallback, validation hint). */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Error notification (auth fail, upload rejected). */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

function safe(fn: () => Promise<void>): void {
  try {
    void fn().catch((e) => logger.debug('haptic call failed', e));
  } catch (e) {
    logger.debug('haptic sync error', e);
  }
}
