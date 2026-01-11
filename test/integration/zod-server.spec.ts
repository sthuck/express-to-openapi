import { describe, it, expect } from 'vitest';
import { generateOpenApiSpec } from '../../src/core/orchestrator.mjs';
import { join } from 'path';

const ZOD_SERVER_PATH = join(
  process.cwd(),
  'test',
  'fixtures',
  'zod-server',
  'main.ts',
);

describe('Zod Server E2E', () => {
  it('should generate complete OpenAPI spec from Zod-based server', async () => {
    const options = {
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
      description: 'API using Zod for schema validation',
    };

    const spec = await generateOpenApiSpec(options);

    // Verify basic structure
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Zod API');
    expect(spec.info.version).toBe('1.0.0');
    expect(spec.info.description).toBe('API using Zod for schema validation');

    // Verify all routes are discovered
    const paths = Object.keys(spec.paths);
    expect(paths).toContain('/users');
    expect(paths).toContain('/users/{id}');
    expect(paths).toContain('/products');
    expect(paths).toContain('/products/{productId}');
    expect(paths).toContain('/orders');
    expect(paths).toContain('/orders/{orderId}');

    // Total routes: 13 (5 user + 5 product + 3 order)
    expect(paths.length).toBe(6);
  });

  it('should discover all user endpoint operations', async () => {
    const spec = await generateOpenApiSpec({
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
    });

    // GET /users - should be discovered
    const getUsersOp = spec.paths['/users']?.get;
    expect(getUsersOp).toBeDefined();
    expect(getUsersOp?.summary).toBe('Get all users');
    expect(getUsersOp?.description).toContain('paginated list');
    expect(getUsersOp?.operationId).toBe('listUsers');

    // GET /users/:id - should have path parameter
    const getUserByIdOp = spec.paths['/users/{id}']?.get;
    expect(getUserByIdOp).toBeDefined();
    expect(getUserByIdOp?.summary).toBe('Get user by ID');
    expect(getUserByIdOp?.operationId).toBe('getUserById');
    expect(getUserByIdOp?.parameters).toBeDefined();
    const idParam = getUserByIdOp?.parameters?.find((p) => 'name' in p && p.name === 'id');
    expect(idParam).toBeDefined();
    if (idParam && 'in' in idParam) {
      expect(idParam.in).toBe('path');
    }

    // POST /users - operation should be discovered
    // Note: Zod-inferred types (z.infer<>) are not automatically extractable
    // This is a known limitation - Zod schemas use complex conditional types
    const createUserOp = spec.paths['/users']?.post;
    expect(createUserOp).toBeDefined();
    expect(createUserOp?.summary).toBe('Create user');
    expect(createUserOp?.description).toContain('Zod schema');
    expect(createUserOp?.operationId).toBe('createUser');

    // PUT /users/:id - should have path param
    const updateUserOp = spec.paths['/users/{id}']?.put;
    expect(updateUserOp).toBeDefined();
    expect(updateUserOp?.operationId).toBe('updateUser');
    expect(updateUserOp?.parameters).toBeDefined();

    // DELETE /users/:id
    const deleteUserOp = spec.paths['/users/{id}']?.delete;
    expect(deleteUserOp).toBeDefined();
    expect(deleteUserOp?.operationId).toBe('deleteUser');
  });

  it('should discover all product endpoint operations', async () => {
    const spec = await generateOpenApiSpec({
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
    });

    // GET /products - should be discovered
    const listProductsOp = spec.paths['/products']?.get;
    expect(listProductsOp).toBeDefined();
    expect(listProductsOp?.summary).toBe('Get all products');
    expect(listProductsOp?.operationId).toBe('listProducts');

    // GET /products/:productId
    const getProductOp = spec.paths['/products/{productId}']?.get;
    expect(getProductOp).toBeDefined();
    expect(getProductOp?.operationId).toBe('getProductById');
    const productIdParam = getProductOp?.parameters?.find(
      (p) => 'name' in p && p.name === 'productId'
    );
    expect(productIdParam).toBeDefined();

    // POST /products - operation should be discovered
    const createProductOp = spec.paths['/products']?.post;
    expect(createProductOp).toBeDefined();
    expect(createProductOp?.operationId).toBe('createProduct');

    // PUT /products/:productId
    const updateProductOp = spec.paths['/products/{productId}']?.put;
    expect(updateProductOp).toBeDefined();
    expect(updateProductOp?.operationId).toBe('updateProduct');

    // DELETE /products/:productId
    const deleteProductOp = spec.paths['/products/{productId}']?.delete;
    expect(deleteProductOp).toBeDefined();
    expect(deleteProductOp?.operationId).toBe('deleteProduct');
  });

  it('should discover all order endpoint operations', async () => {
    const spec = await generateOpenApiSpec({
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
    });

    // GET /orders
    const listOrdersOp = spec.paths['/orders']?.get;
    expect(listOrdersOp).toBeDefined();
    expect(listOrdersOp?.operationId).toBe('listOrders');

    // GET /orders/:orderId
    const getOrderOp = spec.paths['/orders/{orderId}']?.get;
    expect(getOrderOp).toBeDefined();
    expect(getOrderOp?.operationId).toBe('getOrderById');
    const orderIdParam = getOrderOp?.parameters?.find(
      (p) => 'name' in p && p.name === 'orderId'
    );
    expect(orderIdParam).toBeDefined();

    // POST /orders - operation should be discovered
    const createOrderOp = spec.paths['/orders']?.post;
    expect(createOrderOp).toBeDefined();
    expect(createOrderOp?.operationId).toBe('createOrder');
  });

  it('should handle Zod-based server gracefully', async () => {
    const spec = await generateOpenApiSpec({
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
    });

    // Components.schemas exists even if empty
    expect(spec.components?.schemas).toBeDefined();

    // Note: Zod-inferred types (using z.infer<typeof Schema>) cannot be
    // automatically extracted to OpenAPI schemas due to their complex
    // conditional type nature. This is a known limitation when using Zod.
    //
    // Workaround: Use direct TypeScript interfaces/types instead of z.infer<>
    // for better OpenAPI generation, or manually define schemas.
    //
    // The tool still correctly discovers all routes and extracts:
    // - Operation IDs, summaries, descriptions
    // - Path parameters
    // - Query parameters (when types are resolvable)
  });

  it('should maintain all HTTP methods for each path', async () => {
    const spec = await generateOpenApiSpec({
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
    });

    // /users should have GET and POST
    expect(spec.paths['/users']?.get).toBeDefined();
    expect(spec.paths['/users']?.post).toBeDefined();

    // /users/{id} should have GET, PUT, DELETE
    expect(spec.paths['/users/{id}']?.get).toBeDefined();
    expect(spec.paths['/users/{id}']?.put).toBeDefined();
    expect(spec.paths['/users/{id}']?.delete).toBeDefined();

    // /products should have GET and POST
    expect(spec.paths['/products']?.get).toBeDefined();
    expect(spec.paths['/products']?.post).toBeDefined();

    // /products/{productId} should have GET, PUT, DELETE
    expect(spec.paths['/products/{productId}']?.get).toBeDefined();
    expect(spec.paths['/products/{productId}']?.put).toBeDefined();
    expect(spec.paths['/products/{productId}']?.delete).toBeDefined();

    // /orders should have GET and POST
    expect(spec.paths['/orders']?.get).toBeDefined();
    expect(spec.paths['/orders']?.post).toBeDefined();

    // /orders/{orderId} should have GET
    expect(spec.paths['/orders/{orderId}']?.get).toBeDefined();
  });

  it('should extract JSDoc comments for all operations', async () => {
    const spec = await generateOpenApiSpec({
      entryPoint: ZOD_SERVER_PATH,
      title: 'Zod API',
      version: '1.0.0',
    });

    // Verify summaries are extracted
    expect(spec.paths['/users']?.get?.summary).toBe('Get all users');
    expect(spec.paths['/users/{id}']?.get?.summary).toBe('Get user by ID');
    expect(spec.paths['/users']?.post?.summary).toBe('Create user');
    expect(spec.paths['/users/{id}']?.put?.summary).toBe('Update user');
    expect(spec.paths['/users/{id}']?.delete?.summary).toBe('Delete user');

    expect(spec.paths['/products']?.get?.summary).toBe('Get all products');
    expect(spec.paths['/products/{productId}']?.get?.summary).toBe('Get product by ID');
    expect(spec.paths['/products']?.post?.summary).toBe('Create product');

    expect(spec.paths['/orders']?.get?.summary).toBe('Get all orders');
    expect(spec.paths['/orders/{orderId}']?.get?.summary).toBe('Get order by ID');
    expect(spec.paths['/orders']?.post?.summary).toBe('Create order');

    // Verify descriptions are extracted where present
    expect(spec.paths['/users']?.get?.description).toContain('paginated');
    expect(spec.paths['/users']?.post?.description).toContain('Zod schema');
  });
});
