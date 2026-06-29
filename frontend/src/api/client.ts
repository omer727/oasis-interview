import type { ApiError } from '../../../shared/src/types';

export class ApiRequestError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    throw new ApiRequestError(
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? 'An unexpected error occurred',
      res.status,
    );
  }

  return data as T;
}
