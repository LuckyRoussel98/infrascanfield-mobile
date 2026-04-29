import { create } from 'zustand';

import { generateUuid } from '@/utils/format';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  current: Toast | null;
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  dismiss: () => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,

  show: (message, variant = 'info', durationMs = 3000) => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ current: { id: generateUuid(), message, variant } });
    dismissTimer = setTimeout(() => get().dismiss(), durationMs);
  },

  dismiss: () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ current: null });
  },
}));

/** Shortcut helpers for screens that don't want to import the store. */
export const toast = {
  success: (msg: string, durationMs?: number) =>
    useToastStore.getState().show(msg, 'success', durationMs),
  error: (msg: string, durationMs?: number) =>
    useToastStore.getState().show(msg, 'error', durationMs),
  info: (msg: string, durationMs?: number) =>
    useToastStore.getState().show(msg, 'info', durationMs),
};
