import { toast } from "./toast";

export type MutationVerb = "create" | "update" | "delete" | "custom";

export interface NotifyMutationOptions<T> {
  /** Short label for what is being mutated (e.g. "Chatbot", "Document"). */
  entity?: string;
  /** Which kind of mutation this is; drives default messages. */
  verb?: MutationVerb;
  /** Override the loading message entirely. */
  loadingMessage?: string;
  /** Override the success message or derive one from the result. */
  successMessage?: string | ((result: T) => string);
  /** Override the error message or derive one from the error. */
  errorMessage?: string | ((error: unknown) => string);
  /** When false, no loading toast is shown (recommended for very fast ops). */
  showLoading?: boolean;
}

function defaultMessages(entity: string, verb: MutationVerb) {
  switch (verb) {
    case "create":
      return {
        loading: `Creating ${entity.toLowerCase()}…`,
        success: `${entity} created`,
        error: `Failed to create ${entity.toLowerCase()}`,
      };
    case "update":
      return {
        loading: `Updating ${entity.toLowerCase()}…`,
        success: `${entity} updated`,
        error: `Failed to update ${entity.toLowerCase()}`,
      };
    case "delete":
      return {
        loading: `Deleting ${entity.toLowerCase()}…`,
        success: `${entity} deleted`,
        error: `Failed to delete ${entity.toLowerCase()}`,
      };
    default:
      return {
        loading: `Working…`,
        success: `Done`,
        error: `Something went wrong`,
      };
  }
}

/**
 * Wrap any async mutation with consistent loading / success / error toasts.
 *
 * The promise is returned so callers can still await and branch on the result.
 * Errors are re-thrown so existing try/catch/error-state handling keeps working.
 */
export async function notifyMutation<T>(
  action: () => Promise<T>,
  opts: NotifyMutationOptions<T> = {},
): Promise<T> {
  const entity = opts.entity ?? "Item";
  const verb = opts.verb ?? "custom";
  const defaults = defaultMessages(entity, verb);

  const loadingText = opts.loadingMessage ?? defaults.loading;
  const showLoading = opts.showLoading !== false;
  const loadingId = showLoading ? toast.loading(loadingText) : undefined;

  try {
    const result = await action();
    const successText =
      typeof opts.successMessage === "function"
        ? opts.successMessage(result)
        : (opts.successMessage ?? defaults.success);
    toast.success(successText, loadingId ? { id: loadingId } : undefined);
    return result;
  } catch (err) {
    const errorText =
      typeof opts.errorMessage === "function"
        ? opts.errorMessage(err)
        : (opts.errorMessage ?? extractErrorMessage(err, defaults.error));
    toast.error(errorText, loadingId ? { id: loadingId } : undefined);
    throw err;
  }
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object") {
    const maybe = err as { message?: unknown; error?: unknown };
    if (typeof maybe.message === "string" && maybe.message) return maybe.message;
    if (typeof maybe.error === "string" && maybe.error) return maybe.error;
  }
  return fallback;
}
