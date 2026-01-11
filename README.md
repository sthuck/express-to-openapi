# express-to-openapi2

A CLI tool that generates OpenAPI 3.0 specifications from TypeScript Express servers by statically analyzing the code with AST parsing and type extraction.

## Overview

The goal of this project is to build a CLI tool that takes an "entry point" TypeScript file of an Express server and builds an OpenAPI spec from it by parsing the TypeScript code and understanding the types of each route handler.

## Workflow and code conventions

- always add tests and test cases first. For unit tests and small examples, you can create the code base directly as strings and use ts-morph to create the project.
- For longer examples, create a fixture in `test/fixtures`
- avoid long functions, split to smaller functions wherever you can.
- only comment on complicated logic. Otherwise, prefer smaller function with self-explanatory name.
- prefer functional style .map(), .reduce, and .forEach() over loops
- follow "imperative shell, functional core" style.
- When writing tests, please split tests by blocks of comments - //ARRANGE, //ACT, //ASSERT

## Spec:

### Parsing

- should use ts-morph and typescript compiler api where needed.
- should look for calls of `Express.use()`, `Router.use()` and follow them.
- should verify that `app.use()` or `router.use()` is actually of the correct type.
- route handlers are added by calls to `.get()`, `.post()`, `.delete()`, `.patch()` `.put()`
- if multiple route handlers or middleware are passed, should take only the last one.
- should support both an inline or anonymous function being passed as a route handler, named function, and function imported from another file.
- if function is named, add it as operation id in spec.
- unless direct
- it should collect jsdoc from the route handler and add it to the openapi spec.
- have an option on endpoint paths parsing should ignore.

### Type conversion

- should use typeconv library to convert between types
- should support extract query, path and body params.
- if types are named, add them to the schema as `components.schema` with the same name, and use $ref
- if types are not named add them directly to the operation.

If you are not sure what to do, ask, don't continue.

## Project Structure

```
express-to-openapi2/
├── src/
│   ├── ast/              # AST parsing and analysis utilities
│   │   ├── express-checker.mts      # Verifies Express app/router types
│   │   ├── function-resolver.mts    # Resolves function definitions and parameters
│   │   ├── import-follower.mts      # Follows imports across files
│   │   └── project-loader.mts       # Loads TypeScript projects with ts-morph
│   ├── cli/              # Command-line interface
│   │   └── commands.mts             # CLI argument parsing and command handling
│   ├── core/             # Core business logic
│   │   ├── jsdoc-parser.mts         # Extracts JSDoc comments for OpenAPI metadata
│   │   ├── orchestrator.mts         # Coordinates the entire spec generation process
│   │   ├── route-discovery.mts      # Discovers routes from Express app
│   │   ├── spec-builder.mts         # Builds OpenAPI paths and operations
│   │   ├── type-converter.mts       # Converts TypeScript types to OpenAPI schemas
│   │   └── type-extraction.mts      # Extracts Request<P, B, Q> type parameters
│   ├── types/            # TypeScript type definitions
│   │   ├── internal.mts             # Internal data structures
│   │   └── openapi.mts              # OpenAPI 3.0 types
│   ├── utils/            # Utility functions
│   │   ├── path-composer.mts        # Composes Express route paths
│   │   └── path-matcher.mts         # Glob pattern matching for path filtering
│   └── index.mts         # CLI entry point
├── test/
│   ├── fixtures/         # Test Express servers
│   │   ├── complex-server/          # Multi-file server with routers and function-based routes
│   │   ├── nested-routers/          # Tests nested router mounting
│   │   ├── router-server/           # Tests router imports
│   │   ├── simple-server/           # Basic single-file server
│   │   └── zod-server/              # Server using Zod for validation
│   ├── integration/      # End-to-end integration tests
│   └── unit/             # Unit tests for individual modules
└── dist/                 # Compiled JavaScript output
```

## Architecture Overview

### High-Level Flow

```
Entry Point (main.ts)
         ↓
    Orchestrator
         ↓
   ┌─────┴─────┐
   ↓           ↓
Route      Project
Discovery   Loader
   ↓           ↓
Spec      Type
Builder   Extraction
   ↓           ↓
OpenAPI Spec Output
```

### Core Pipeline

1. **Project Loading** (`project-loader.mts`)
   - Loads TypeScript project using ts-morph
   - Provides configured TypeScript compiler for AST analysis

2. **Route Discovery** (`route-discovery.mts`)
   - Finds Express app initialization
   - Discovers all route registrations (`.get()`, `.post()`, etc.)
   - Follows router mounting with `app.use()`
   - Recursively processes function-based route definitions
   - Tracks visited functions to prevent infinite recursion

3. **Type Extraction** (`type-extraction.mts`)
   - Extracts type parameters from `Request<Params, Body, Query>`
   - Resolves type aliases and interfaces
   - Handles path parameters, request body, and query parameters

4. **Spec Building** (`spec-builder.mts`)
   - Converts routes to OpenAPI paths and operations
   - Extracts JSDoc for summaries and descriptions
   - Generates parameter schemas from types
   - Creates component schemas for named types

5. **Type Conversion** (`type-converter.mts`)
   - Converts TypeScript types to OpenAPI/JSON Schema
   - Uses typeconv library for complex type transformations
   - Handles primitives, objects, arrays, unions, and literals

## Key Architecture Decisions

### 1. AST-Based Static Analysis

**Decision:** Use ts-morph and TypeScript Compiler API for static code analysis instead of runtime introspection.

**Rationale:**
- No need to execute user code (security)
- Can analyze code without runtime dependencies
- Access to full type information at compile time
- Can follow imports and analyze multi-file projects

**Trade-offs:**
- Cannot extract Zod-inferred types (`z.infer<>`) due to complex conditional types
- Limited to statically analyzable patterns
- Cannot handle dynamic route registration

### 2. Recursive Route Discovery with Scope Tracking

**Decision:** Implement recursive route discovery that follows function calls and tracks scope.

**Implementation:** `discoverRoutesInScope(scope, sourceFile, appOrRouterName, ...)`

**Rationale:**
- Supports common real-world pattern: `setupApp(app)` where routes are in functions
- Tracks parameter name changes (e.g., `app` → `application`)
- Prevents duplicate discoveries by scoping search to current function body
- Prevents infinite recursion with visited function set

**Key Features:**
- Function call detection: finds calls passing app as argument
- Parameter tracking: maps argument index to parameter name
- Scope isolation: only searches within current scope to avoid duplicates
- Cross-file support: follows imported setup functions

### 3. Router Mounting with Path Composition

**Decision:** Recursively follow `app.use(path, router)` and compose paths.

**Implementation:**
```typescript
app.use('/api', userRouter);        // basePath = '/api'
userRouter.get('/users', handler);  // fullPath = '/api/users'
```

**Rationale:**
- Mirrors Express runtime behavior
- Supports nested router mounting
- Enables modular route organization

### 4. Import Following Strategy

**Decision:** Follow imports to resolve handlers and routers in other files.

**Implementation:** `import-follower.mts` resolves named and default imports.

**Rationale:**
- Real-world Express apps split routes across files
- Need to analyze handler types from their definition location
- Must follow router imports to discover mounted routes

**Challenges Solved:**
- Resolves both named and default imports
- Handles re-exports
- Tracks source file changes during recursion

### 5. Type Extraction from Request Generics

**Decision:** Extract types from `Request<Params, Body, Query>` generic parameters.

**Pattern:**
```typescript
function handler(
  req: Request<{ id: string }, CreateUserBody, PaginationQuery>,
  res: Response
) { }
```

**Extraction:**
- 1st param: Path parameters (`:id`)
- 2nd param: Request body
- 3rd param: Query parameters

**Rationale:**
- Standard TypeScript pattern for typing Express handlers
- Provides complete type information in one place
- Compiler validates types against usage

**Limitations:**
- Cannot extract from Zod-inferred types due to conditional type complexity
- Requires explicit Request generic usage

### 6. Path Filtering with Glob Patterns

**Decision:** Support glob patterns (`*`, `**`) for ignoring paths.

**Implementation:** Custom pattern matcher in `path-matcher.mts`

**Examples:**
```bash
--ignore "/internal/*"      # Ignore /internal/anything
--ignore "**/private"       # Ignore any /private path at any level
--ignore "/api/*/admin"     # Ignore /api/users/admin, /api/posts/admin, etc.
```

**Rationale:**
- Users need to exclude internal/admin routes from public API docs
- Glob patterns are familiar and expressive
- Avoids complex regex syntax

### 7. Warning System for Missing Type Information

**Decision:** Emit warnings (not errors) when routes lack type information.

**Behavior:**
```
Warning: Route GET /users has no type information.
Consider adding Request type annotations for better OpenAPI spec generation.
```

**Rationale:**
- Tool should not fail on partial type information
- Graceful degradation: generate spec with what's available
- Warnings guide users to improve their code
- Allows incremental adoption

### 8. Component Schema Extraction

**Decision:** Extract named types to `components.schemas` with `$ref` references.

**Pattern:**
```typescript
interface CreateUserRequest {
  name: string;
  email: string;
}

// Generates:
{
  "components": {
    "schemas": {
      "CreateUserRequest": {
        "type": "object",
        "properties": { ... }
      }
    }
  },
  "paths": {
    "/users": {
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/CreateUserRequest" }
            }
          }
        }
      }
    }
  }
}
```

**Rationale:**
- Reduces duplication in spec
- Improves readability
- Enables schema reuse across operations
- Standard OpenAPI practice

### 9. JSDoc Integration

**Decision:** Extract JSDoc comments for OpenAPI metadata.

**Mapping:**
- `@summary` → `operation.summary`
- `@description` → `operation.description`
- Multiline comment → `operation.description`

**Rationale:**
- Developers already write JSDoc
- Avoids separate documentation files
- Single source of truth for API docs

### 10. Imperative Shell, Functional Core

**Decision:** Follow "imperative shell, functional core" architecture.

**Implementation:**
- **Shell:** CLI, orchestrator, project loading (side effects)
- **Core:** Route discovery, type extraction, spec building (pure functions)

**Benefits:**
- Easier to test (pure functions)
- Better separation of concerns
- Clearer data flow

## Design Patterns

### 1. Visitor Pattern
- Route discovery traverses AST nodes
- Applies different handlers for different node types
- Uses ts-morph's `getDescendantsOfKind()` for targeted traversal

### 2. Builder Pattern
- `SpecBuilder` incrementally constructs OpenAPI spec
- Separates spec construction from route discovery
- Allows flexibility in output format

### 3. Strategy Pattern
- Different type conversion strategies for primitives, objects, arrays
- Import following strategies for named vs. default imports
- Function resolution strategies for declarations, expressions, arrows

### 4. Recursion with Memoization
- Recursive route discovery with visited function tracking
- Prevents infinite loops in circular function calls
- Caches resolved functions by unique key (file path + position)

## Module Responsibilities

### AST Layer (`src/ast/`)
**Responsibility:** Low-level AST manipulation and traversal

- `express-checker.mts`: Type verification for Express constructs
- `function-resolver.mts`: Function definition resolution and parameter extraction
- `import-follower.mts`: Cross-file import resolution
- `project-loader.mts`: ts-morph project initialization

**Design Principle:** Pure functions that operate on ts-morph nodes

### Core Layer (`src/core/`)
**Responsibility:** Business logic and spec generation

- `route-discovery.mts`: Route discovery algorithm
- `type-extraction.mts`: Type parameter extraction from Request
- `spec-builder.mts`: OpenAPI spec construction
- `type-converter.mts`: TypeScript → OpenAPI schema conversion
- `jsdoc-parser.mts`: JSDoc extraction
- `orchestrator.mts`: Coordinates entire pipeline

**Design Principle:** Domain logic independent of I/O

### Utilities Layer (`src/utils/`)
**Responsibility:** Reusable utility functions

- `path-composer.mts`: Express path composition logic
- `path-matcher.mts`: Glob pattern matching

**Design Principle:** Generic, testable utilities with no dependencies on other layers

### CLI Layer (`src/cli/`)
**Responsibility:** User interface and I/O

- `commands.mts`: Argument parsing, file I/O, console output

**Design Principle:** Thin layer that delegates to core

## Testing Strategy

### Unit Tests (`test/unit/`)
- Test individual functions in isolation
- Use in-memory TypeScript projects (ts-morph)
- Mock external dependencies
- Test edge cases and error handling

**Coverage:** 86.66% overall, 91.26% for route discovery

### Integration Tests (`test/integration/`)
- Test complete pipeline end-to-end
- Use fixture projects in `test/fixtures/`
- Verify full OpenAPI spec output
- Test cross-file scenarios

### Test Fixtures (`test/fixtures/`)
- **simple-server**: Basic single-file Express app
- **complex-server**: Multi-file with routers and function-based routes
- **router-server**: Router imports and mounting
- **nested-routers**: Multiple levels of router nesting
- **zod-server**: Zod validation (demonstrates limitations)

**Strategy:** Fixtures represent real-world patterns

## Known Limitations

### 1. Zod-Inferred Types
**Limitation:** Cannot extract types from `z.infer<typeof Schema>`

**Reason:** Zod uses complex conditional types that cannot be statically resolved

**Workaround:** Use direct TypeScript interfaces alongside Zod schemas

### 2. Dynamic Routes
**Limitation:** Cannot handle runtime-generated routes

```typescript
// Not supported
const routes = ['users', 'posts'];
routes.forEach(r => app.get(`/${r}`, handler));
```

**Reason:** Static analysis cannot evaluate runtime logic

### 3. Middleware-Modified Types
**Limitation:** Cannot track type changes through middleware

```typescript
// Type changes from middleware not tracked
app.use((req, res, next) => {
  req.user = getCurrentUser();  // Not reflected in route types
  next();
});
```

**Reason:** Would require interprocedural data flow analysis

## Performance Considerations

- **Lazy Loading:** Only loads and parses files that are actually imported
- **Single Parse:** Each file parsed once, even if imported multiple times
- **Recursion Guards:** Prevents infinite loops with visited tracking
- **Scope Isolation:** Only searches relevant AST subtrees

## Future Enhancements

- [ ] Response type extraction
- [ ] Middleware chain analysis
- [ ] Custom decorators support
- [ ] Validation schema integration (Joi, Yup)
- [ ] OpenAPI 3.1 support
- [ ] Watch mode for development
- [ ] Plugin system for custom extractors
