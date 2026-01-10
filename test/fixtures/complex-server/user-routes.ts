import { Router, Request, Response } from 'express';
import {
  CreateUserRequest,
  UpdateUserRequest,
  PaginationQuery,
} from './types';

const userRouter = Router();

/**
 * List all users with pagination
 * @summary Get all users
 */
function listUsers(
  req: Request<{}, {}, {}, PaginationQuery>,
  res: Response,
) {
  res.json([]);
}

/**
 * Get a specific user by ID
 * @summary Get user by ID
 */
function getUserById(
  req: Request<{ id: string }>,
  res: Response,
) {
  res.json({ id: 1, name: 'John Doe' });
}

/**
 * Create a new user
 * @summary Create user
 */
function createUser(
  req: Request<{}, {}, CreateUserRequest>,
  res: Response,
) {
  res.status(201).json({ id: 1 });
}

/**
 * Update an existing user
 * @summary Update user
 */
function updateUser(
  req: Request<{ id: string }, {}, UpdateUserRequest>,
  res: Response,
) {
  res.json({ id: 1, name: 'Updated' });
}

/**
 * Delete a user
 * @summary Delete user
 */
function deleteUser(
  req: Request<{ id: string }>,
  res: Response,
) {
  res.status(204).send();
}

/**
 * Search users by query
 * @summary Search users
 */
function searchUsers(
  req: Request<{}, {}, {}, { q: string; role?: string }>,
  res: Response,
) {
  res.json([]);
}

userRouter.get('/', listUsers);
userRouter.get('/search', searchUsers);
userRouter.get('/:id', getUserById);
userRouter.post('/', createUser);
userRouter.put('/:id', updateUser);
userRouter.delete('/:id', deleteUser);

export default userRouter;
