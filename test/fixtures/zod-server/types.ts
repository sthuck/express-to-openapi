import { z } from 'zod';

// User schemas
export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  age: z.number().int().positive().optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

export const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

export const PaginationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('10'),
  sort: z.enum(['name', 'email', 'createdAt']).optional(),
});

// Product schemas
export const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inStock: z.boolean().default(true),
});

export const ProductParamsSchema = z.object({
  productId: z.string(),
});

export const ProductQuerySchema = z.object({
  category: z.string().optional(),
  minPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  inStock: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

// Order schemas
export const CreateOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
});

export const OrderParamsSchema = z.object({
  orderId: z.string(),
});

// Infer TypeScript types from Zod schemas
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type UserParams = z.infer<typeof UserParamsSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export type CreateProductRequest = z.infer<typeof CreateProductSchema>;
export type ProductParams = z.infer<typeof ProductParamsSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;

export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;
export type OrderParams = z.infer<typeof OrderParamsSchema>;
