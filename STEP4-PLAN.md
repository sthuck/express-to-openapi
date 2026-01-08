# Step 4: Route Discovery - Mini Implementation Plan

## Overview
Build the route discovery system that traverses an Express application's AST to find all registered routes, following router mounting and collecting handler information.

## Goals
1. Find all `app.get()`, `app.post()`, etc. calls
2. Verify calls are on actual Express/Router instances
3. Follow `app.use()` and `Router.use()` to track router mounting
4. Compose full paths from base paths and route paths
5. Extract handlers using our existing function resolver
6. Return structured route information

## Data Structures

### Internal Types (types/internal.mts)
```typescript
interface RouteInfo {
  path: string;           // Full composed path: "/api/users"
  method: HttpMethod;     // "get" | "post" | "put" | "patch" | "delete"
  handlerName?: string;   // Function name if available
  handlerNode: Node;      // The actual handler function node
}

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface RouterMount {
  basePath: string;       // Base path where router is mounted
  routerNode: Node;       // The router variable/expression
}
```

## Algorithm Design

### High-Level Flow
```
1. Load source file with project loader
2. Find Express app initialization: `const app = express()`
3. Traverse all statements looking for:
   - Route registrations: app.get(), app.post(), etc.
   - Router mounts: app.use('/path', router)
   - Router creations: Router()
4. For each router mount, recursively discover routes on that router
5. Compose paths: basePath + routePath
6. Return array of RouteInfo
```

### Key Functions to Implement

#### 1. `discoverRoutes(sourceFile: SourceFile): RouteInfo[]`
- Main entry point
- Find the Express app variable
- Call `discoverRoutesOnApp()` with empty base path

#### 2. `discoverRoutesOnApp(appOrRouter: Node, basePath: string): RouteInfo[]`
- Find all method calls on this app/router
- For each `.get()`, `.post()`, etc.: extract route
- For each `.use()`: check if it's mounting a router
- Recursively process mounted routers with composed base path

#### 3. `isExpressApp(node: Node): boolean`
- Check if a variable was initialized with `express()`
- Use type checker to verify it's an Express application

#### 4. `isRouter(node: Node): boolean`
- Check if a variable was initialized with `Router()` or `express.Router()`
- Use type checker to verify it's a Router instance

#### 5. `extractRouteFromMethodCall(call: CallExpression, basePath: string): RouteInfo | null`
- Get method name (get, post, etc.)
- Get first argument (path string)
- Use function resolver to get handler
- Compose full path
- Return RouteInfo

#### 6. `extractRouterMount(call: CallExpression): RouterMount | null`
- Verify it's a `.use()` call
- Get first argument as base path
- Get second argument as router reference
- Return mount info or null if not a router mount

#### 7. `composePath(basePath: string, routePath: string): string`
- Handle leading/trailing slashes
- Combine base + route paths correctly
- Examples:
  - `composePath("/api", "/users")` → "/api/users"
  - `composePath("/api", "users")` → "/api/users"
  - `composePath("/api/", "/users")` → "/api/users"
  - `composePath("", "/users")` → "/users"

## Implementation Steps (TDD)

### Sub-step 4.1: Path Composition Utility
**File**: `src/utils/path-composer.mts`
**Test**: `test/unit/path-composer.spec.ts`

Test cases:
```typescript
// ARRANGE & ACT & ASSERT
expect(composePath("", "/users")).toBe("/users")
expect(composePath("/", "/users")).toBe("/users")
expect(composePath("/api", "/users")).toBe("/api/users")
expect(composePath("/api", "users")).toBe("/api/users")
expect(composePath("/api/", "/users")).toBe("/api/users")
expect(composePath("/api/v1", "/users/:id")).toBe("/api/v1/users/:id")
```

### Sub-step 4.2: Express/Router Type Checking
**File**: `src/ast/express-checker.mts`
**Test**: `test/unit/express-checker.spec.ts`

Test cases:
```typescript
it("should identify express app", () => {
  // ARRANGE
  const code = `
    import express from 'express';
    const app = express();
  `;

  // ACT
  const appVar = findVariable('app');

  // ASSERT
  expect(isExpressApp(appVar)).toBe(true);
});

it("should identify router", () => {
  // ARRANGE
  const code = `
    import express from 'express';
    const router = express.Router();
  `;

  // ACT
  const routerVar = findVariable('router');

  // ASSERT
  expect(isRouter(routerVar)).toBe(true);
});

it("should reject non-express objects", () => {
  // ARRANGE
  const code = `
    const fakeApp = { get: () => {} };
  `;

  // ACT
  const fakeVar = findVariable('fakeApp');

  // ASSERT
  expect(isExpressApp(fakeVar)).toBe(false);
});
```

### Sub-step 4.3: Simple Route Extraction
**File**: `src/core/route-discovery.mts`
**Test**: `test/unit/route-discovery.spec.ts`

Test case 1 - Single inline route:
```typescript
it("should discover simple GET route with inline handler", () => {
  // ARRANGE
  const code = `
    import express from 'express';
    const app = express();
    app.get('/users', (req, res) => {
      res.json({ users: [] });
    });
  `;

  // ACT
  const routes = discoverRoutes(sourceFile);

  // ASSERT
  expect(routes).toHaveLength(1);
  expect(routes[0].path).toBe('/users');
  expect(routes[0].method).toBe('get');
  expect(routes[0].handlerNode).toBeDefined();
});
```

Test case 2 - Multiple methods:
```typescript
it("should discover multiple HTTP methods", () => {
  // ARRANGE
  const code = `
    import express from 'express';
    const app = express();
    app.get('/users', getUsers);
    app.post('/users', createUser);
    app.delete('/users/:id', deleteUser);
  `;

  // ACT
  const routes = discoverRoutes(sourceFile);

  // ASSERT
  expect(routes).toHaveLength(3);
  expect(routes.map(r => r.method)).toEqual(['get', 'post', 'delete']);
  expect(routes.map(r => r.path)).toEqual(['/users', '/users', '/users/:id']);
});
```

### Sub-step 4.4: Router Mounting
**Test Fixture**: `test/fixtures/router-server/main.ts`
```typescript
import express from 'express';
import { Router } from 'express';

const app = express();

const userRouter = Router();
userRouter.get('/', getUsers);
userRouter.post('/', createUser);
userRouter.get('/:id', getUser);

app.use('/api/users', userRouter);

app.listen(3000);
```

Test case:
```typescript
it("should follow router mounting", () => {
  // ARRANGE
  const fixtureFile = loadFixture('router-server/main.ts');

  // ACT
  const routes = discoverRoutes(fixtureFile);

  // ASSERT
  expect(routes).toHaveLength(3);
  expect(routes[0].path).toBe('/api/users');
  expect(routes[0].method).toBe('get');
  expect(routes[1].path).toBe('/api/users');
  expect(routes[1].method).toBe('post');
  expect(routes[2].path).toBe('/api/users/:id');
  expect(routes[2].method).toBe('get');
});
```

### Sub-step 4.5: Nested Routers
**Test Fixture**: `test/fixtures/nested-routers/main.ts`
```typescript
import express from 'express';
import { Router } from 'express';

const app = express();

const apiRouter = Router();
const userRouter = Router();

userRouter.get('/', getUsers);
userRouter.get('/:id', getUser);

apiRouter.use('/users', userRouter);
app.use('/api/v1', apiRouter);

app.listen(3000);
```

Test case:
```typescript
it("should handle nested routers", () => {
  // ARRANGE
  const fixtureFile = loadFixture('nested-routers/main.ts');

  // ACT
  const routes = discoverRoutes(fixtureFile);

  // ASSERT
  expect(routes).toHaveLength(2);
  expect(routes[0].path).toBe('/api/v1/users');
  expect(routes[1].path).toBe('/api/v1/users/:id');
});
```

### Sub-step 4.6: Edge Cases

Test case - Multiple middleware:
```typescript
it("should extract handler from multiple middleware", () => {
  // ARRANGE
  const code = `
    import express from 'express';
    const app = express();
    app.get('/protected', auth, logger, handler);
  `;

  // ACT
  const routes = discoverRoutes(sourceFile);

  // ASSERT
  expect(routes).toHaveLength(1);
  expect(routes[0].handlerName).toBe('handler');
});
```

Test case - Router from another file:
```typescript
it("should follow imported routers", () => {
  // ARRANGE
  // main.ts:
  //   import { userRouter } from './routes/users';
  //   app.use('/users', userRouter);
  // routes/users.ts:
  //   export const userRouter = Router();
  //   userRouter.get('/', handler);

  // ACT
  const routes = discoverRoutes(mainFile);

  // ASSERT
  expect(routes).toHaveLength(1);
  expect(routes[0].path).toBe('/users');
});
```

## Implementation Order

1. **Path composer** (simple utility) ✓
2. **Express/Router checker** (type verification) ✓
3. **Simple route extraction** (single file, no routers) ✓
4. **Router mounting** (single level) ✓
5. **Nested routers** (multiple levels) ✓
6. **Edge cases** (imported routers, middleware) ✓

## Challenges & Solutions

### Challenge 1: Finding the app variable
**Solution**: Search for `express()` call expressions, track the variable it's assigned to

### Challenge 2: Following router references
**Solution**: Use our import follower to resolve router variables across files

### Challenge 3: Handling dynamic paths
**Solution**: For now, extract path as-is. Template strings like `/users/${id}` stay as string representation

### Challenge 4: Circular router dependencies
**Solution**: Track visited routers in a Set to prevent infinite loops

### Challenge 5: Router used before definition
**Solution**: Do two-pass analysis or use ts-morph's symbol resolution

## Success Criteria

- [ ] Can discover simple routes on express app
- [ ] Can follow single-level router mounting
- [ ] Can follow nested routers
- [ ] Correctly composes paths from base + route
- [ ] Extracts handler using function resolver
- [ ] Handles middleware arrays correctly
- [ ] Works with imported routers
- [ ] All tests pass with AAA structure

## Notes

- Keep functions small and focused
- Use existing function resolver for handler extraction
- Use existing import follower for cross-file router tracking
- Write tests first (TDD)
- Each sub-step should have passing tests before moving to next
