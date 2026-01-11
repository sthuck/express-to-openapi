import express, { Request, Response } from 'express';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserParams,
  PaginationQuery,
  CreateProductRequest,
  ProductParams,
  ProductQuery,
  CreateOrderRequest,
  OrderParams,
} from './types';

const app = express();

app.use(express.json());

// ============================================================================
// User Routes
// ============================================================================

/**
 * List all users with pagination
 * @summary Get all users
 * @description Retrieves a paginated list of users with optional sorting
 */
function listUsers(
  req: Request<{}, {}, {}, PaginationQuery>,
  res: Response,
) {
  const { page, limit, sort } = req.query;
  res.json({
    users: [],
    pagination: {
      page: page || 1,
      limit: limit || 10,
      total: 0,
    },
    sort,
  });
}

/**
 * Get a specific user by ID
 * @summary Get user by ID
 */
function getUserById(
  req: Request<UserParams>,
  res: Response,
) {
  const { id } = req.params;
  res.json({ id, name: 'John Doe', email: 'john@example.com' });
}

/**
 * Create a new user
 * @summary Create user
 * @description Creates a new user with validated data from Zod schema
 */
function createUser(
  req: Request<{}, {}, CreateUserRequest>,
  res: Response,
) {
  const userData = req.body;
  res.status(201).json({
    id: '123e4567-e89b-12d3-a456-426614174000',
    ...userData,
  });
}

/**
 * Update an existing user
 * @summary Update user
 */
function updateUser(
  req: Request<UserParams, {}, UpdateUserRequest>,
  res: Response,
) {
  const { id } = req.params;
  const updates = req.body;
  res.json({ id, ...updates });
}

/**
 * Delete a user
 * @summary Delete user
 */
function deleteUser(
  req: Request<UserParams>,
  res: Response,
) {
  res.status(204).send();
}

// ============================================================================
// Product Routes
// ============================================================================

/**
 * List all products with optional filters
 * @summary Get all products
 */
function listProducts(
  req: Request<{}, {}, {}, ProductQuery>,
  res: Response,
) {
  const { category, minPrice, maxPrice, inStock } = req.query;
  res.json({
    products: [],
    filters: { category, minPrice, maxPrice, inStock },
  });
}

/**
 * Get a specific product by ID
 * @summary Get product by ID
 */
function getProductById(
  req: Request<ProductParams>,
  res: Response,
) {
  const { productId } = req.params;
  res.json({
    id: productId,
    name: 'Sample Product',
    price: 99.99,
  });
}

/**
 * Create a new product
 * @summary Create product
 */
function createProduct(
  req: Request<{}, {}, CreateProductRequest>,
  res: Response,
) {
  const productData = req.body;
  res.status(201).json({
    id: 'prod_123',
    ...productData,
  });
}

/**
 * Update a product
 * @summary Update product
 */
function updateProduct(
  req: Request<ProductParams, {}, Partial<CreateProductRequest>>,
  res: Response,
) {
  const { productId } = req.params;
  const updates = req.body;
  res.json({ id: productId, ...updates });
}

/**
 * Delete a product
 * @summary Delete product
 */
function deleteProduct(
  req: Request<ProductParams>,
  res: Response,
) {
  res.status(204).send();
}

// ============================================================================
// Order Routes
// ============================================================================

/**
 * List all orders
 * @summary Get all orders
 */
function listOrders(
  req: Request,
  res: Response,
) {
  res.json({ orders: [] });
}

/**
 * Get a specific order by ID
 * @summary Get order by ID
 */
function getOrderById(
  req: Request<OrderParams>,
  res: Response,
) {
  const { orderId } = req.params;
  res.json({
    id: orderId,
    status: 'pending',
  });
}

/**
 * Create a new order
 * @summary Create order
 */
function createOrder(
  req: Request<{}, {}, CreateOrderRequest>,
  res: Response,
) {
  const orderData = req.body;
  res.status(201).json({
    id: 'order_123',
    ...orderData,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

// ============================================================================
// Route Registration
// ============================================================================

// User routes
app.get('/users', listUsers);
app.get('/users/:id', getUserById);
app.post('/users', createUser);
app.put('/users/:id', updateUser);
app.delete('/users/:id', deleteUser);

// Product routes
app.get('/products', listProducts);
app.get('/products/:productId', getProductById);
app.post('/products', createProduct);
app.put('/products/:productId', updateProduct);
app.delete('/products/:productId', deleteProduct);

// Order routes
app.get('/orders', listOrders);
app.get('/orders/:orderId', getOrderById);
app.post('/orders', createOrder);

export default app;
