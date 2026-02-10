import express, { Request, Response } from 'express';

const app = express();

// Types for typed handlers
interface UserParams {
  id: string;
}

interface UserBody {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
}

// Simulate common wrapper functions

/**
 * Wraps async handlers to catch errors
 */
function asyncHandler<T>(fn: T): T {
  return fn;
}

/**
 * Custom async wrapper with different naming
 */
function myCustomAsyncWrapper<T>(fn: T): T {
  return fn;
}

/**
 * Authentication middleware wrapper
 */
function withAuth<T>(fn: T): T {
  return fn;
}

/**
 * Validation wrapper
 */
function validateRequest<T>(fn: T): T {
  return fn;
}

// Routes with different wrapper patterns

/**
 * Get user by ID
 * @summary Get a user
 * @description Fetches a user by their unique ID
 */
app.get('/users/:id', asyncHandler((req: Request<UserParams, UserResponse>, res: Response) => {
  res.json({ id: req.params.id, name: 'John', email: 'john@example.com' });
}));

/**
 * Create a new user
 * @summary Create user
 * @description Creates a new user with the provided data
 */
app.post('/users', asyncHandler((req: Request<{}, UserResponse, UserBody>, res: Response) => {
  res.json({ id: '123', ...req.body });
}));

/**
 * Protected admin endpoint
 * @summary Admin endpoint
 * @description Access admin functionality
 */
app.get('/admin', withAuth((req: Request<{}, { admin: boolean }>, res: Response) => {
  res.json({ admin: true });
}));

/**
 * Custom wrapper pattern
 * @summary Custom wrapped endpoint
 */
app.get('/custom', myCustomAsyncWrapper((req: Request<{}, { custom: string }>, res: Response) => {
  res.json({ custom: 'value' });
}));

/**
 * Nested wrapper - auth + async
 * @summary Nested wrappers
 */
app.get('/nested', withAuth(asyncHandler((req: Request<{}, { nested: boolean }>, res: Response) => {
  res.json({ nested: true });
})));

/**
 * Validated request
 * @summary Validated endpoint
 */
app.post('/validated', validateRequest((req: Request<{}, { valid: boolean }, { data: string }>, res: Response) => {
  res.json({ valid: true });
}));

/**
 * Route without wrapper (for comparison)
 * @summary Direct handler
 */
app.get('/direct', (req: Request<{}, { direct: boolean }>, res: Response) => {
  res.json({ direct: true });
});

export default app;
