import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Thin, app-wide wrapper around sonner.
 *
 * Prefer `notifyMutation` (below) for CRUD side-effects so every "added / updated /
 * deleted" flow in the app renders a consistent toast. Use the raw helpers here
 * (`toast.success`, `toast.error`, ...) for one-off notifications that don't fit the
 * mutation shape (e.g. "Copied to clipboard").
 */
export const toast = {
  success(message: string, options?: ExternalToast) {
    return sonnerToast.success(message, options);
  },
  error(message: string, options?: ExternalToast) {
    return sonnerToast.error(message, options);
  },
  info(message: string, options?: ExternalToast) {
    return sonnerToast(message, options);
  },
  warning(message: string, options?: ExternalToast) {
    return sonnerToast.warning(message, options);
  },
  loading(message: string, options?: ExternalToast) {
    return sonnerToast.loading(message, options);
  },
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },
};

export type ToastHandle = ReturnType<typeof sonnerToast.loading>;
