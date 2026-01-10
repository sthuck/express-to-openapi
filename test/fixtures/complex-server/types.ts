// Shared type definitions for the complex server

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: 'admin' | 'user';
}

export interface PaginationQuery {
  page: number;
  limit: number;
  sort?: string;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  published?: boolean;
}
