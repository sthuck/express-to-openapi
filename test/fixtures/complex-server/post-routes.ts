import { Router, Request, Response } from 'express';
import { CreatePostRequest } from './types';

const postRouter = Router();

/**
 * Get all posts for a user
 * @summary List user posts
 */
function getUserPosts(
  req: Request<{ userId: string }, {}, {}, { published?: boolean }>,
  res: Response,
) {
  res.json([]);
}

/**
 * Create a new post for a user
 * @summary Create post
 */
function createUserPost(
  req: Request<{ userId: string }, {}, CreatePostRequest>,
  res: Response,
) {
  res.status(201).json({ id: 1 });
}

/**
 * Get a specific post
 * @summary Get post by ID
 */
function getUserPost(
  req: Request<{ userId: string; postId: string }>,
  res: Response,
) {
  res.json({ id: 1, title: 'Post Title' });
}

/**
 * Update a post with inline type
 */
function updateUserPost(
  req: Request<{ userId: string; postId: string }, {}, { title?: string; content?: string }>,
  res: Response,
) {
  res.json({ id: 1 });
}

/**
 * Delete a post
 */
function deleteUserPost(
  req: Request<{ userId: string; postId: string }>,
  res: Response,
) {
  res.status(204).send();
}

postRouter.get('/', getUserPosts);
postRouter.post('/', createUserPost);
postRouter.get('/:postId', getUserPost);
postRouter.put('/:postId', updateUserPost);
postRouter.delete('/:postId', deleteUserPost);

export default postRouter;
