# Zod Server Fixture

This fixture demonstrates using Zod for runtime validation in an Express TypeScript server.

## Pattern

This server uses a common real-world pattern:

1. **Define Zod schemas** for validation (`types.ts`)
2. **Infer TypeScript types** from Zod schemas using `z.infer<typeof Schema>`
3. **Use inferred types** in Express request handlers

```typescript
// Define Zod schema
export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// Infer TypeScript type
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;

// Use in handler
function createUser(
  req: Request<{}, {}, CreateUserRequest>,
  res: Response,
) {
  // req.body is typed as CreateUserRequest
}
```

## OpenAPI Generation Limitations

**Known Limitation**: Types inferred from Zod schemas (`z.infer<typeof Schema>`) cannot be automatically extracted to OpenAPI schemas.

### Why?

Zod's `z.infer<>` uses complex TypeScript conditional types and mapped types that are computed at compile time. The AST-based type extraction cannot resolve these complex generic transformations back to their original structure.

### What Works

✅ **Route discovery** - All endpoints are correctly discovered
✅ **Operation metadata** - Summaries, descriptions, operation IDs
✅ **Path parameters** - Extracted from route paths
✅ **Query parameters** - Extracted when types are directly resolvable

### What Doesn't Work

❌ **Request body schemas** - Zod-inferred types in request body
❌ **Complex nested Zod types** - Arrays, objects from `z.infer<>`
❌ **Schema references** - Cannot generate `$ref` to Zod schemas

### Workarounds

**Option 1: Use Direct TypeScript Types**

Instead of:
```typescript
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
```

Define interfaces directly:
```typescript
export interface CreateUserRequest {
  name: string;
  email: string;
  age?: number;
  role?: 'admin' | 'user' | 'guest';
}
```

**Option 2: Manual Schema Definition**

Use a library like `@asteasolutions/zod-to-openapi` to manually map Zod schemas to OpenAPI.

**Option 3: Hybrid Approach**

- Use Zod for runtime validation
- Use TypeScript interfaces for type definitions
- Keep both in sync manually or with codegen

## Test Coverage

This fixture includes comprehensive E2E tests that verify:

- ✅ All 13 routes are discovered across 3 resource types
- ✅ All HTTP methods (GET, POST, PUT, DELETE) are correctly identified
- ✅ Path parameters are extracted
- ✅ JSDoc comments are converted to OpenAPI descriptions
- ✅ Tool handles Zod-based servers gracefully without errors

## Real-World Usage

This fixture represents a realistic scenario where:

1. Teams use Zod for its excellent runtime validation
2. TypeScript types are inferred from Zod for DRY principles
3. OpenAPI specs are generated for documentation

The tool correctly handles this use case by discovering all routes and metadata, while gracefully degrading for complex type inference that cannot be statically analyzed.
