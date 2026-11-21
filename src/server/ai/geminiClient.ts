import { GoogleGenAI } from '@google/genai';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'Gemini API key is not configured on the server. Configure GEMINI_API_KEY in Settings > Secrets, or continue using MOTIONFORGE offline with local media and deterministic motion graphics.',
      503,
      'API_KEY_MISSING'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'AI_SERVICE_ERROR') {
    super(message);
    this.name = 'GeminiServiceError';
    this.status = status;
    this.code = code;
  }
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = status === 429 || status === 503 || status === 500;
      if (!isRetryable || attempt === maxRetries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt)));
    }
  }
  throw formatGeminiError(lastError);
}

export function formatGeminiError(error: unknown): GeminiServiceError {
  if (error instanceof GeminiServiceError) return error;
  const err = error as { status?: number; message?: string };
  const msg = err?.message || 'An unexpected AI service error occurred.';
  const status = typeof err?.status === 'number' ? err.status : 500;

  if (status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return new GeminiServiceError(
      'API key permission denied or invalid. Check your key in Settings > Secrets.',
      403,
      'PERMISSION_DENIED'
    );
  }
  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return new GeminiServiceError(
      'API quota exhausted or paid-tier billing is required for this model. Select a billing-enabled key in Settings > Secrets or try a standard-tier model.',
      429,
      'RESOURCE_EXHAUSTED'
    );
  }
  if (status === 404 || msg.includes('NOT_FOUND')) {
    return new GeminiServiceError(
      `Requested model was not found or is unavailable for your account: ${msg}`,
      404,
      'MODEL_NOT_FOUND'
    );
  }

  return new GeminiServiceError(msg, status >= 400 && status < 600 ? status : 500, 'UPSTREAM_ERROR');
}
