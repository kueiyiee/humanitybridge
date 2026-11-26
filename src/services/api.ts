import type { ApiResponse } from '../../packages/shared/types';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('hb_csrf');
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  const payload = (await res.json().catch(() => ({
    success: false,
    message: 'Invalid server response',
    data: null,
  }))) as ApiResponse<T>;

  if (!res.ok || !payload.success) {
    throw new ApiClientError(res.status, payload.message || 'Request failed', payload.data);
  }

  return payload;
}

export async function apiBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('hb_csrf');
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; data?: unknown } | null;
    throw new ApiClientError(response.status, payload?.message || 'The requested file could not be retrieved.', payload?.data);
  }
  return response.blob();
}
