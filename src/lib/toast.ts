export type ToastTone = 'info' | 'success' | 'error';

export interface ToastPayload {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

const TOAST_EVENT = 'arti-toast';

let counter = 0;

/**
 * Fire a warm toast from anywhere (client only). The <Toaster /> mounted in
 * the (main) layout listens for these events and renders them.
 */
export function toast(
  message: string,
  opts: { tone?: ToastTone; duration?: number } = {},
): void {
  if (typeof window === 'undefined') return;
  const detail: ToastPayload = {
    id: ++counter,
    message,
    tone: opts.tone ?? 'info',
    duration: opts.duration ?? 3000,
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail }));
}

toast.success = (message: string, duration?: number) =>
  toast(message, { tone: 'success', duration });
toast.error = (message: string, duration?: number) =>
  toast(message, { tone: 'error', duration });

export { TOAST_EVENT };
