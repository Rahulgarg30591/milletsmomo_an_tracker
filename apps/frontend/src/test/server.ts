import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * One mock API for every component test.
 *
 * Handlers are reset between tests, so a test that needs a different response
 * — an error, an empty day — overrides just that route with server.use().
 */
export const server = setupServer(...handlers);
