import { isAxiosError } from 'axios';

/** The server's `{ error }` message from a failed request, if it sent one. */
export function errorDetail(error: unknown): string | undefined {
  return isAxiosError(error) && typeof error.response?.data?.error === 'string'
    ? error.response.data.error
    : undefined;
}
