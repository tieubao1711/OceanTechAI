export enum AIProviderErrorType {
  TIMEOUT = "TIMEOUT",
  RATE_LIMIT = "RATE_LIMIT",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  AUTHENTICATION = "AUTHENTICATION",
  NETWORK = "NETWORK",
  UNKNOWN = "UNKNOWN",
}

export type AIProviderErrorParams = {
  type: AIProviderErrorType;
  message: string;
  originalError?: unknown;
  retryable: boolean;
};

export class AIProviderError extends Error {
  readonly type: AIProviderErrorType;
  readonly originalError?: unknown;
  readonly retryable: boolean;

  constructor(params: AIProviderErrorParams) {
    super(sanitizeProviderMessage(params.message));
    this.name = "AIProviderError";
    this.type = params.type;
    this.originalError = params.originalError;
    this.retryable = params.retryable;
  }
}

const API_KEY_PATTERN = /sk-[a-zA-Z0-9_-]{8,}/g;

export function sanitizeProviderMessage(message: string): string {
  return message.replace(API_KEY_PATTERN, "sk-[REDACTED]");
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const obj = err as Record<string, unknown>;
  if (typeof obj.status === "number") return obj.status;
  if (typeof obj.statusCode === "number") return obj.statusCode;
  const response = obj.response as Record<string, unknown> | undefined;
  if (response && typeof response.status === "number") return response.status;
  return undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

function getErrorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  return "";
}

export function mapProviderError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;

  const message = getErrorMessage(err);
  const lower = message.toLowerCase();
  const status = getErrorStatus(err);
  const name = getErrorName(err);

  if (name === "AbortError" || lower.includes("timeout") || lower.includes("timed out")) {
    return new AIProviderError({
      type: AIProviderErrorType.TIMEOUT,
      message,
      originalError: err,
      retryable: true,
    });
  }

  if (status === 429 || lower.includes("rate limit")) {
    return new AIProviderError({
      type: AIProviderErrorType.RATE_LIMIT,
      message,
      originalError: err,
      retryable: true,
    });
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("authentication")
  ) {
    return new AIProviderError({
      type: AIProviderErrorType.AUTHENTICATION,
      message,
      originalError: err,
      retryable: false,
    });
  }

  if (
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("socket hang up")
  ) {
    return new AIProviderError({
      type: AIProviderErrorType.NETWORK,
      message,
      originalError: err,
      retryable: true,
    });
  }

  return new AIProviderError({
    type: AIProviderErrorType.UNKNOWN,
    message,
    originalError: err,
    retryable: false,
  });
}

export function createInvalidResponseError(detail: string): AIProviderError {
  return new AIProviderError({
    type: AIProviderErrorType.INVALID_RESPONSE,
    message: detail,
    retryable: false,
  });
}
