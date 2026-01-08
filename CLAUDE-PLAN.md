# Implementation Plan: express-to-openapi2 CLI Tool

## Overview
Build a CLI tool that parses Express TypeScript servers and generates OpenAPI 3.0 specifications by analyzing TypeScript code with ts-morph.

## Key Clarifications
- **OpenAPI Version**: 3.0 (not 2.0, despite project name)
- **CLI Packaging**: Node script only (run with `node dist/index.mjs`)
- **CLI Parser**: Use a library (commander or yargs)
- **Code Style**: "Imperative shell, functional core" + TDD approach

## Architecture

### Module Structure
```
src/
├── index.mts                     # CLI entry point
├── cli/
│   └── commands.mts              # CLI command definitions
├── core/
│   ├── route-discovery.mts       # Find all routes in Express app
│   ├── type-extraction.mts       # Extract TS types from handlers
│   ├── spec-builder.mts          # Build OpenAPI 3.0 document
│   └── jsdoc-parser.mts          # Extract JSDoc comments
├── ast/
│   ├── project-loader.mts        # Load TS project with ts-morph
│   ├── function-resolver.mts     # Resolve function references
│   └── import-follower.mts       # Follow imports across files
├── types/
│   └── internal.mts              # Internal type definitions
└── utils/
    └── path-matcher.mts          # Path ignore pattern matching
```

### Data Flow
```
CLI Args → Project Loader → Route Discovery → Type Extraction → Spec Builder → OpenAPI JSON
```

## Implementation Steps (TDD - Test First!)

### Phase 1: Foundation & AST Tools

#### Step 1: Project Loader
**File**: `src/ast/project-loader.mts`
**Test**: `test/unit/project-loader.spec.ts`
**Purpose**: Load TypeScript files with ts-morph
**Test cases**:
- Load a simple TypeScript file
- Load file with imports
- Handle non-existent files
- Use tsconfig.json if available

#### Step 2: Function Resolver
**File**: `src/ast/function-resolver.mts`
**Test**: `test/unit/function-resolver.spec.ts`
**Purpose**: Resolve different function reference styles
**Test cases** (inline code with ts-morph):
- Inline arrow: `app.get('/', (req, res) => {})`
- Inline function: `app.get('/', function(req, res) {})`
- Named reference: `app.get('/', myHandler)`
- Multiple handlers: `app.get('/', middleware1, middleware2, handler)` → take last

#### Step 3: Import Follower
**File**: `src/ast/import-follower.mts`
**Test**: `test/unit/import-follower.spec.ts`
**Purpose**: Follow imports to find function definitions
**Test cases**:
- Named import: `import { handler } from './handlers'`
- Default import: `import handler from './handlers'`
- Relative vs absolute paths

### Phase 2: Route Discovery

#### Step 4: Route Discovery Core
**File**: `src/core/route-discovery.mts`
**Test**: `test/unit/route-discovery.spec.ts`
**Purpose**: Traverse Express app and find all routes
**Key logic**:
1. Find `app.use()`, `Router.use()` calls
2. Verify they're on Express/Router types (not random objects)
3. Follow router mounting: `app.use('/api', router)`
4. Find route handlers: `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`
5. Extract handler (last function in args)

**Test fixture**: Create `test/fixtures/router-server/` with nested routers
**Test cases**:
- Simple routes: `app.get('/', handler)`
- Nested routers: `app.use('/api', router)` + `router.get('/users', handler)`
- Multiple routers at different paths

#### Step 5: JSDoc Parser
**File**: `src/core/jsdoc-parser.mts`
**Test**: `test/unit/jsdoc-parser.spec.ts`
**Purpose**: Extract JSDoc comments from functions
**Test case**:
```typescript
/**
 * Get user by ID
 * @summary Retrieves a user
 * @param {string} id - User ID
 */
function getUser(req, res) {}
```

### Phase 3: Type System

#### Step 6: Type Extraction
**File**: `src/core/type-extraction.mts`
**Test**: `test/unit/type-extraction.spec.ts`
**Purpose**: Extract TypeScript types from Request generic parameters
**Test cases**:
```typescript
// Path params: Request<{ id: string }>
app.get('/:id', (req: Request<{ id: string }>, res) => {})

// Query params: Request<{}, {}, {}, { page: number }>
app.get('/', (req: Request<{}, {}, {}, { page: number }>, res) => {})

// Body params: Request<{}, {}, CreateUserBody>
interface CreateUserBody { name: string; email: string }
app.post('/', (req: Request<{}, {}, CreateUserBody>, res) => {})

// Inline body type
app.post('/', (req: Request<{}, {}, { name: string }>, res) => {})
```

**Key decision**: Named types (interfaces/type aliases) → add to `components.schemas` with $ref. Inline types → inline in operation.

### Phase 4: OpenAPI Spec Building

#### Step 7: Spec Builder
**File**: `src/core/spec-builder.mts`
**Test**: `test/unit/spec-builder.spec.ts`
**Purpose**: Build OpenAPI 3.0 document from discovered routes
**Test cases**:
- Create basic document structure (openapi: "3.0.0")
- Add paths and operations
- Add parameters (path, query)
- Add requestBody for POST/PUT/PATCH
- Add schemas to components.schemas for named types
- Add operationId from function names
- Add description/summary from JSDoc
- Handle duplicate type names (warn and dedupe)

**Use typeconv**: Convert TypeScript types to OpenAPI schemas
- Since typeconv outputs OpenAPI 3.0, we can use it directly!
- For named types: generate schema, add to components, return $ref
- For inline types: generate schema, add inline

### Phase 5: CLI & Integration

#### Step 8: CLI Setup
**File**: `src/cli/commands.mts`
**Test**: `test/unit/commands.spec.ts`
**Add dependency**: Choose CLI library (commander or yargs)
**CLI Arguments**:
- Entry point (required): `--entry <file>` or first positional
- Output file (optional): `--output <file>` (default: stdout)
- Ignore paths (optional): `--ignore <patterns...>`
- Title (optional): `--title <title>`
- Version (optional): `--version <version>`

**Entry point** (`src/index.mts`):
```typescript
#!/usr/bin/env node
import { program } from 'commander'; // or yargs
// Define CLI, call main orchestrator
```

#### Step 9: End-to-End Integration
**File**: `test/integration/e2e.spec.ts`
**Fixture**: `test/fixtures/complex-server/`
**Purpose**: Full end-to-end test
- Create complex Express server with:
  - Nested routers
  - Named and inline types
  - JSDoc comments
  - Query, path, and body params
- Run full pipeline
- Verify generated OpenAPI 3.0 spec is valid
- Check all routes present
- Check schemas correct

### Phase 6: Polish

#### Step 10: Path Ignore Patterns
**File**: `src/utils/path-matcher.mts`
**Test**: `test/unit/path-matcher.spec.ts`
**Purpose**: Filter out paths matching ignore patterns
**Support glob patterns**: `/admin/*`, `/internal/**`

#### Step 11: Error Handling
- Handle missing files gracefully
- Warn on routes with no type information
- Handle circular imports
- Provide helpful error messages

## Critical Files

These 5 files form the backbone:

1. **src/core/route-discovery.mts** - Core route traversal logic
2. **src/ast/function-resolver.mts** - Function reference resolution
3. **src/core/type-extraction.mts** - Extract TS types from Request<>
4. **src/core/spec-builder.mts** - Build OpenAPI 3.0 document
5. **src/cli/commands.mts** - CLI interface

## Internal Data Model

```typescript
// types/internal.mts
interface RouteInfo {
  path: string;                    // Full path including router base
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  handler: FunctionInfo;
}

interface FunctionInfo {
  name?: string;                   // For operationId
  node: Node;                      // ts-morph node
  parameters: ParameterInfo[];
  jsdoc?: JSDocInfo;
}

interface ParameterInfo {
  name: string;                    // 'req', 'res'
  type?: Type;                     // TypeScript type
  paramTypes?: {
    path?: Type;                   // Request<PathParams, ...>
    query?: Type;                  // Request<P, Q, B, Query>
    body?: Type;                   // Request<P, Q, Body>
  };
}

interface JSDocInfo {
  summary?: string;
  description?: string;
  tags: Map<string, string>;
}
```

## Key Design Decisions

### 1. Middleware Chain Handling
When multiple handlers are passed as arguments, take only the last one:
```typescript
app.get('/path', middleware1, middleware2, actualHandler)
// → Extract actualHandler (last argument that is a function)
```

### 2. Named vs Inline Types
```typescript
// Named type → $ref
interface User { name: string }
app.post('/', (req: Request<{}, {}, User>, res) => {})
// → components.schemas.User + $ref: "#/components/schemas/User"

// Inline type → inline schema
app.post('/', (req: Request<{}, {}, { name: string }>, res) => {})
// → schema directly in requestBody
```

**Detection**: Use ts-morph to check if type has an Interface/TypeAlias declaration

### 3. Express Type Verification
Don't blindly follow all `.use()` calls - verify they're on Express/Router:
```typescript
// Good: app is Express
const app = express();
app.use('/api', router);

// Ignore: obj is not Express
const obj = { use: () => {} };
obj.use('/api', router);
```

Use TypeChecker to verify the type.

### 4. Router Path Composition
```typescript
app.use('/api', router);
router.get('/users', handler);
// → Final path: /api/users
```

Maintain path context while traversing.

## Testing Strategy

### Unit Tests (Vitest)
- Use inline code strings with ts-morph for fast tests
- Mock dependencies
- Test edge cases

Example:
```typescript
const project = new Project({ useInMemoryFileSystem: true });
const file = project.createSourceFile('test.ts', `
  import express from 'express';
  const app = express();
  app.get('/', (req, res) => {});
`);
// Test route discovery on this file
```

### Integration Tests
- Use fixtures in `test/fixtures/`
- Test full pipeline from entry point to OpenAPI output
- Validate output against OpenAPI 3.0 JSON schema

### Fixtures to Create
- `router-server/` - Nested routers
- `typed-routes/` - Named types (interfaces)
- `inline-types/` - Inline types
- `jsdoc-routes/` - JSDoc comments
- `middleware-server/` - Multiple handlers
- `imported-handlers/` - Handlers from other files
- `complex-server/` - Comprehensive integration test

## Package Updates Needed

### Add CLI library dependency
```json
{
  "dependencies": {
    "commander": "^12.0.0"  // or "yargs": "^17.7.2"
  }
}
```

### Update scripts
```json
{
  "scripts": {
    "start": "node dist/index.mjs",
    "dev": "tsx src/index.mts"
  }
}
```

## Verification Plan

### Unit Test Verification
```bash
yarn test
# All unit tests should pass
```

### Integration Test Verification
```bash
yarn build
node dist/index.mjs test/fixtures/complex-server/main.ts --output test.json
# Verify test.json is valid OpenAPI 3.0
# Check all routes present
# Check schemas in components
```

### Manual Test
Create a real Express server, run the tool, verify output in Swagger Editor:
1. Generate spec from fixture
2. Open https://editor.swagger.io/
3. Paste generated JSON
4. Verify no errors, routes look correct

## Success Criteria

- [ ] All unit tests pass
- [ ] Integration test generates valid OpenAPI 3.0
- [ ] CLI accepts all specified arguments
- [ ] Handles named and inline types correctly
- [ ] Extracts JSDoc and adds to spec
- [ ] Supports routers with nested paths
- [ ] Supports inline, named, and imported handlers
- [ ] Path ignore patterns work
- [ ] Code follows conventions: small functions, functional style, well-tested

## Implementation Order

1. **Foundation** (Steps 1-3): AST tools
2. **Discovery** (Steps 4-5): Route finding + JSDoc
3. **Types** (Step 6): Type extraction
4. **OpenAPI** (Step 7): Spec building
5. **CLI** (Steps 8-9): Interface + E2E test
6. **Polish** (Steps 10-11): Ignore patterns + error handling

Each step: Write tests first → Implement → Verify tests pass → Move to next step
