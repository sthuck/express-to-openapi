# Step 7: OpenAPI Spec Builder - Implementation Plan

## Overview
Build OpenAPI 3.0 specification documents from discovered routes, extracted types, and JSDoc comments. This is the core transformation step that converts TypeScript/Express code into OpenAPI format.

## Key Challenges
1. Converting TypeScript types to OpenAPI schemas (use typeconv)
2. Distinguishing named types (→ components.schemas) vs inline types
3. Mapping Express paths with params to OpenAPI paths
4. Handling different HTTP methods and their specific needs
5. Deduplicating schema names in components

## Sub-Steps

### 7.1: Basic OpenAPI Document Structure
**File**: `src/core/spec-builder.mts`
**Test**: `test/unit/spec-builder.spec.ts`
**Purpose**: Create minimal valid OpenAPI 3.0 document

**Test cases**:
```typescript
// Empty document
const spec = buildOpenApiSpec([], { title: 'My API', version: '1.0.0' });
expect(spec.openapi).toBe('3.0.0');
expect(spec.info.title).toBe('My API');
expect(spec.info.version).toBe('1.0.0');
expect(spec.paths).toEqual({});

// Document with custom info
const spec = buildOpenApiSpec([], {
  title: 'Test API',
  version: '2.0.0',
  description: 'API description'
});
expect(spec.info.description).toBe('API description');
```

**Implementation**:
```typescript
interface BuildOptions {
  title: string;
  version: string;
  description?: string;
}

function buildOpenApiSpec(routes: RouteInfo[], options: BuildOptions): OpenAPISpec {
  return {
    openapi: '3.0.0',
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths: {},
    components: {
      schemas: {},
    },
  };
}
```

### 7.2: Path and Operation Creation
**Purpose**: Add routes to paths with correct HTTP methods

**Test cases**:
```typescript
// Simple GET route
const routes = [{
  path: '/users',
  method: 'get',
  handlerName: 'getUsers',
  handlerNode: mockNode,
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users']).toBeDefined();
expect(spec.paths['/users'].get).toBeDefined();
expect(spec.paths['/users'].get.operationId).toBe('getUsers');

// Multiple methods on same path
const routes = [
  { path: '/users', method: 'get', handlerName: 'getUsers', ... },
  { path: '/users', method: 'post', handlerName: 'createUser', ... },
];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].get).toBeDefined();
expect(spec.paths['/users'].post).toBeDefined();

// Multiple paths
const routes = [
  { path: '/users', method: 'get', ... },
  { path: '/posts', method: 'get', ... },
];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(Object.keys(spec.paths)).toEqual(['/users', '/posts']);
```

**Implementation**:
- Group routes by path
- For each path, create operations for each method
- Set operationId from handlerName if available
- Add default responses (200 with empty schema for now)

### 7.3: JSDoc Integration
**Purpose**: Add summary/description from JSDoc to operations

**Test cases**:
```typescript
// Route with JSDoc description
const mockNode = createMockFunctionWithJSDoc(`
  /**
   * Get all users from the database
   * @summary Retrieve users
   */
  function getUsers(req, res) {}
`);
const routes = [{
  path: '/users',
  method: 'get',
  handlerNode: mockNode,
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].get.summary).toBe('Retrieve users');
expect(spec.paths['/users'].get.description).toBe('Get all users from the database');

// Route without JSDoc
const mockNode = createMockFunction('function getUsers(req, res) {}');
const routes = [{ path: '/users', method: 'get', handlerNode: mockNode }];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].get.summary).toBeUndefined();
```

**Implementation**:
- Call parseJsDoc(handlerNode) for each route
- Add summary and description to operation if present
- Skip if no JSDoc found

### 7.4: Path Parameters
**Purpose**: Extract path parameters from Express paths and type info

**Test cases**:
```typescript
// Express path with param
const routes = [{
  path: '/users/:id',
  method: 'get',
  handlerNode: mockNodeWithTypes({
    pathParams: {
      isNamed: false,
      typeText: '{ id: string }',
    },
  }),
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users/{id}'].get.parameters).toHaveLength(1);
expect(spec.paths['/users/{id}'].get.parameters[0]).toEqual({
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
});

// Multiple path params
const routes = [{
  path: '/users/:userId/posts/:postId',
  method: 'get',
  handlerNode: mockNodeWithTypes({
    pathParams: {
      isNamed: false,
      typeText: '{ userId: string; postId: string }',
    },
  }),
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users/{userId}/posts/{postId}'].get.parameters).toHaveLength(2);
```

**Implementation**:
1. Convert Express path format (`:id`) to OpenAPI format (`{id}`)
2. Extract path param names from path string
3. If pathParams typeInfo exists, convert to OpenAPI schema using typeconv
4. For each param in path, create parameter object with schema
5. All path params are required: true

**Helper function**:
```typescript
function convertExpressPathToOpenAPI(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

function extractPathParamNames(path: string): string[] {
  const matches = path.matchAll(/:(\w+)/g);
  return Array.from(matches, m => m[1]);
}
```

### 7.5: Query Parameters
**Purpose**: Add query parameters from type info

**Test cases**:
```typescript
// Inline query params
const routes = [{
  path: '/users',
  method: 'get',
  handlerNode: mockNodeWithTypes({
    queryParams: {
      isNamed: false,
      typeText: '{ page: number; limit: number }',
    },
  }),
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].get.parameters).toHaveLength(2);
expect(spec.paths['/users'].get.parameters[0]).toMatchObject({
  name: 'page',
  in: 'query',
  required: false, // Query params are optional by default
  schema: { type: 'number' },
});

// Named query params
const routes = [{
  path: '/users',
  method: 'get',
  handlerNode: mockNodeWithTypes({
    queryParams: {
      isNamed: true,
      typeName: 'PaginationQuery',
      typeNode: mockInterfaceNode('interface PaginationQuery { page: number }'),
    },
  }),
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
// Should inline the query params, not create a ref
expect(spec.paths['/users'].get.parameters[0].schema).toMatchObject({ type: 'number' });
```

**Implementation**:
- Convert typeText/typeNode to OpenAPI schema using typeconv
- Extract property names from schema
- Create parameter object for each property
- Set `in: 'query'`, `required: false` (unless marked otherwise in TS)
- Query params are always inlined (not $ref) per OpenAPI conventions

### 7.6: Request Body
**Purpose**: Add requestBody for POST/PUT/PATCH with body types

**Test cases**:
```typescript
// POST with inline body type
const routes = [{
  path: '/users',
  method: 'post',
  handlerNode: mockNodeWithTypes({
    bodyParams: {
      isNamed: false,
      typeText: '{ name: string; email: string }',
    },
  }),
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].post.requestBody).toBeDefined();
expect(spec.paths['/users'].post.requestBody.content['application/json'].schema).toEqual({
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
  },
  required: ['name', 'email'],
});

// POST with named body type
const routes = [{
  path: '/users',
  method: 'post',
  handlerNode: mockNodeWithTypes({
    bodyParams: {
      isNamed: true,
      typeName: 'CreateUserRequest',
      typeNode: mockInterfaceNode('interface CreateUserRequest { name: string }'),
    },
  }),
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].post.requestBody.content['application/json'].schema).toEqual({
  $ref: '#/components/schemas/CreateUserRequest',
});
expect(spec.components.schemas.CreateUserRequest).toBeDefined();

// GET without body (should not have requestBody)
const routes = [{
  path: '/users',
  method: 'get',
  handlerNode: mockNode,
}];
const spec = buildOpenApiSpec(routes, defaultOptions);
expect(spec.paths['/users'].get.requestBody).toBeUndefined();
```

**Implementation**:
- Only add requestBody for POST/PUT/PATCH methods
- If bodyParams is inline: convert to schema and inline
- If bodyParams is named: add to components.schemas, use $ref
- Set content type to `application/json`
- Set `required: true` for requestBody

### 7.7: TypeScript to OpenAPI Schema Conversion
**Purpose**: Convert TypeScript types to OpenAPI schemas using typeconv

**Research**:
- Install and use `typeconv` package
- typeconv can convert TypeScript to OpenAPI 3.0 schemas
- Need to handle both type text strings and ts-morph nodes

**Test cases**:
```typescript
// Simple object type
const schema = convertTypeToSchema('{ name: string; age: number }');
expect(schema).toEqual({
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
});

// Optional properties
const schema = convertTypeToSchema('{ name: string; age?: number }');
expect(schema.required).toEqual(['name']);

// Arrays
const schema = convertTypeToSchema('{ tags: string[] }');
expect(schema.properties.tags).toEqual({
  type: 'array',
  items: { type: 'string' },
});

// Nested objects
const schema = convertTypeToSchema('{ user: { name: string } }');
expect(schema.properties.user).toMatchObject({
  type: 'object',
  properties: { name: { type: 'string' } },
});
```

**Implementation**:
```typescript
import { convert } from 'typeconv';

async function convertTypeToSchema(typeText: string): Promise<OpenAPISchema> {
  const result = await convert({
    data: `type T = ${typeText}`,
    from: 'typescript',
    to: 'oapi',
  });
  // Parse result and extract schema for type T
  return parsedSchema;
}
```

**Note**: This might need to be async. If so, make buildOpenApiSpec async too.

### 7.8: Schema Deduplication
**Purpose**: Handle duplicate named types in components.schemas

**Test cases**:
```typescript
// Same type name used in multiple routes
const routes = [
  {
    path: '/users',
    method: 'post',
    handlerNode: mockNodeWithTypes({
      bodyParams: { isNamed: true, typeName: 'User', typeNode: userNode },
    }),
  },
  {
    path: '/users/:id',
    method: 'put',
    handlerNode: mockNodeWithTypes({
      bodyParams: { isNamed: true, typeName: 'User', typeNode: userNode },
    }),
  },
];
const spec = buildOpenApiSpec(routes, defaultOptions);
// Should only have one User schema
expect(Object.keys(spec.components.schemas)).toEqual(['User']);

// Different types with same name (should warn and suffix)
const routes = [
  {
    path: '/users',
    method: 'post',
    handlerNode: mockNodeWithTypes({
      bodyParams: { isNamed: true, typeName: 'User', typeNode: userNode1 },
    }),
  },
  {
    path: '/posts',
    method: 'post',
    handlerNode: mockNodeWithTypes({
      bodyParams: { isNamed: true, typeName: 'User', typeNode: userNode2 }, // Different User
    }),
  },
];
const spec = buildOpenApiSpec(routes, defaultOptions);
// Should have User and User_2 (or similar)
expect(Object.keys(spec.components.schemas)).toContain('User');
expect(Object.keys(spec.components.schemas).length).toBe(2);
```

**Implementation**:
- Maintain a Map<string, string> of typeName → schema JSON
- When adding a named type to components:
  - Check if name exists
  - If exists and schemas match → reuse
  - If exists and schemas differ → warn, suffix with _2, _3, etc.
- Log warnings for schema conflicts

### 7.9: Integration Test
**Purpose**: Full end-to-end spec building

**Test case**:
```typescript
// Complex route with all features
const project = new Project({ useInMemoryFileSystem: true });
const file = project.createSourceFile('test.ts', `
  import { Request, Response } from 'express';

  interface CreateUserBody {
    name: string;
    email: string;
  }

  /**
   * Create a new user in the system
   * @summary Create user
   */
  function createUser(
    req: Request<{}, {}, CreateUserBody>,
    res: Response
  ) {
    res.json({ id: 1 });
  }
`);

const routes = [{
  path: '/users',
  method: 'post',
  handlerName: 'createUser',
  handlerNode: file.getFunctions()[0],
}];

const spec = buildOpenApiSpec(routes, {
  title: 'Test API',
  version: '1.0.0',
});

// Verify complete spec structure
expect(spec.openapi).toBe('3.0.0');
expect(spec.paths['/users'].post).toMatchObject({
  operationId: 'createUser',
  summary: 'Create user',
  description: 'Create a new user in the system',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/CreateUserBody' },
      },
    },
  },
});
expect(spec.components.schemas.CreateUserBody).toBeDefined();
```

## OpenAPI Types

Create types for OpenAPI 3.0 document structure:

```typescript
// types/openapi.mts
export interface OpenAPISpec {
  openapi: string;
  info: InfoObject;
  paths: PathsObject;
  components?: ComponentsObject;
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
}

export interface PathsObject {
  [path: string]: PathItemObject;
}

export interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: ResponsesObject;
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema: SchemaObject;
  description?: string;
}

export interface RequestBodyObject {
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: SchemaObject | ReferenceObject;
    };
  };
}

export interface ComponentsObject {
  schemas?: {
    [key: string]: SchemaObject;
  };
}

export interface SchemaObject {
  type?: string;
  properties?: { [key: string]: SchemaObject };
  required?: string[];
  items?: SchemaObject;
  $ref?: string;
  [key: string]: any; // Additional schema keywords
}

export interface ReferenceObject {
  $ref: string;
}

export interface ResponsesObject {
  [statusCode: string]: ResponseObject;
}

export interface ResponseObject {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: SchemaObject | ReferenceObject;
    };
  };
}
```

## Implementation Order

1. **7.1**: Basic document structure
2. **7.7**: TypeScript to OpenAPI conversion (needed by later steps)
3. **7.2**: Path and operation creation
4. **7.3**: JSDoc integration
5. **7.4**: Path parameters
6. **7.5**: Query parameters
7. **7.6**: Request body
8. **7.8**: Schema deduplication
9. **7.9**: Integration test

## Dependencies

### Add typeconv package
```bash
npm install typeconv
```

### Research typeconv usage
- How to convert TypeScript type text to OpenAPI schema
- How to handle ts-morph nodes (may need to extract text first)
- Whether it's async or sync
- How to parse the output format

## Success Criteria

- [ ] Creates valid OpenAPI 3.0.0 documents
- [ ] All HTTP methods supported
- [ ] Path parameters extracted and typed correctly
- [ ] Query parameters extracted and typed correctly
- [ ] Request bodies for POST/PUT/PATCH
- [ ] Named types → components.schemas with $ref
- [ ] Inline types → inlined in operation
- [ ] JSDoc → summary/description
- [ ] Schema deduplication works
- [ ] All tests pass
- [ ] Integration test with complex route succeeds

## Notes

- typeconv might be async - if so, make buildOpenApiSpec async
- Query parameters should always be inlined per OpenAPI conventions
- Path parameters are always required: true
- Request bodies are required: true by default
- May need helper to determine if type properties are required/optional
- Consider adding default 200 response for all operations
