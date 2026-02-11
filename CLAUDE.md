# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**express-to-openapi** is a CLI tool that generates OpenAPI 3.0 specifications from TypeScript Express servers via static AST analysis. It parses Express application code without executing it, extracting route definitions, types, and metadata.

## Commands

```bash
# Build
yarn build          # Compile TypeScript (tsc)

# Test
yarn test           # Run all tests (Vitest)
yarn test path/to/file.spec.ts  # Run specific test file

# Development
yarn dev            # Run with tsx (TypeScript in Node)
yarn lint           # ESLint
yarn format         # Prettier

# CLI usage
./dist/index.mjs <entry-point> [options]
# Options: -o/--output, -t/--title, -v/--api-version, -d/--description, -i/--ignore, -w/--wrapper-pattern, --debug

# Wrapper pattern example - match custom wrappers via regex
./dist/index.mjs server.ts -w "myCustom.*" "auth.*"
```

## Architecture

```
CLI (commands.mts)
       ↓
Orchestrator (orchestrator.mts) ─── coordinates pipeline
       ↓
Route Discovery (route-discovery.mts → scope-discovery.mts)
       ↓                              ↓
Type Extraction                 Import Following
(type-extraction.mts)          (import-follower.mts)
       ↓
Spec Builder (spec-builder.mts) ─── type-converter.mts
       ↓
OpenAPI 3.0 Spec Output
```

### Core Modules

| Module | Purpose |
|--------|---------|
| `src/core/orchestrator.mts` | Pipeline entry point, coordinates generation |
| `src/core/scope-discovery.mts` | **Main algorithm** - recursive route discovery within scopes |
| `src/core/route-discovery.mts` | Finds Express app variable, delegates to scope-discovery |
| `src/core/spec-builder.mts` | Constructs OpenAPI paths/operations from routes |
| `src/core/type-extraction.mts` | Extracts types from `Request<P, Res, Body, Query>` and `Response<ResBody>` using typeChecker |
| `src/core/type-converter.mts` | Converts TypeScript types to JSON Schema via `typeconv` |
| `src/ast/import-follower.mts` | Follows imports across files to resolve handlers/routers |
| `src/ast/function-resolver.mts` | Resolves handlers, unwraps wrappers (asyncHandler, etc.) |

### Key Patterns

1. **Recursive Route Discovery**: `discoverRoutesInScope()` recursively processes scopes, tracking visited functions to prevent cycles

2. **Wrapper Unwrapping**: Handles patterns like `asyncHandler(handler)`, `authMiddleware(handler)` - unwraps up to 10 levels deep to extract inner handler types
   - Default wrapper names: `asyncHandler`, `catchAsync`, `wrapAsync`, `authMiddleware`, `authenticate`, `authorize`, `validate`, `withAuth`, `tryCatch`
   - Custom patterns via CLI: `-w "myWrapper.*"` matches any wrapper name starting with "myWrapper"
   - Config interface: `WrapperConfig { names?: string[], patterns?: RegExp[] }`

3. **Router Mounting**: Follows `app.use(path, router)` calls, composing full paths from nested routers

4. **Import Following**: Resolves handlers/routers across files via named and default imports

5. **Type Extraction**: Uses TypeScript's typeChecker to resolve complex types from Request/Response generics:
   - Extracts from both `Request<P, Res, Body, Query>` and `Response<ResBody>`
   - Utility types: `Partial<T>`, `Pick<T>`, `Omit<T>`, `Record<K,V>`
   - Union/intersection types: `A | B`, `A & B`
   - Zod inferred types: `z.infer<typeof Schema>`
   - Nested types: Recursively expands nested object types (e.g., `{ address: Address }` → `{ address: { street: string; city: string } }`)
   - `expandTypeToStructure()` recursively resolves types to structural form with circular reference detection

6. **Component Schemas**: Named types extracted to `components.schemas` with `$ref` references

## Test Structure

- **Unit tests**: `test/unit/` - individual module tests
- **Integration tests**: `test/integration/` - e2e with fixtures
- **Fixtures**: `test/fixtures/` - real Express app examples (simple-server, complex-server, router-server, nested-routers, wrapper-pattern-server, zod-server)

Coverage target: 80%+ (currently ~87%)

## Known Limitations

- Dynamic/runtime-generated routes not supported
- No decorator support currently
- Deeply nested conditional types may not fully resolve
