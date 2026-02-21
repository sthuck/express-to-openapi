# express-to-openapi Architecture Overview

This document provides a comprehensive overview of the express-to-openapi codebase architecture.

## High-Level Data Flow

```mermaid
flowchart TB
    subgraph Input
        CLI[CLI Arguments]
        TS[TypeScript Express Server]
    end

    subgraph Pipeline["Core Pipeline"]
        CMD[commands.mts<br/>CLI Parsing]
        ORC[orchestrator.mts<br/>Pipeline Coordinator]
        PL[project-loader.mts<br/>Load ts-morph Project]
        RD[route-discovery.mts<br/>Find Express App]
        SD[scope-discovery.mts<br/>Recursive Route Discovery]
        SB[spec-builder.mts<br/>Build OpenAPI Spec]
    end

    subgraph Output
        SPEC[OpenAPI 3.0 JSON]
    end

    CLI --> CMD
    TS --> PL
    CMD --> ORC
    ORC --> PL
    ORC --> RD
    RD --> SD
    ORC --> SB
    SB --> SPEC
```

## Module Architecture

```mermaid
flowchart LR
    subgraph CLI["CLI Layer"]
        index[index.mts]
        commands[commands.mts]
    end

    subgraph Core["Core Modules"]
        orch[orchestrator.mts]
        rd[route-discovery.mts]
        sd[scope-discovery.mts]
        sb[spec-builder.mts]
        te[type-extraction.mts]
        tc[type-converter.mts]
        jsdoc[jsdoc-parser.mts]
    end

    subgraph AST["AST Utilities"]
        pl[project-loader.mts]
        ec[express-checker.mts]
        fr[function-resolver.mts]
        if[import-follower.mts]
    end

    subgraph Utils["Utilities"]
        pc[path-composer.mts]
        pm[path-matcher.mts]
        log[logger.mts]
    end

    index --> commands
    commands --> orch
    orch --> pl
    orch --> rd
    orch --> sb
    orch --> pm

    rd --> sd
    rd --> ec

    sd --> fr
    sd --> if
    sd --> ec
    sd --> pc

    sb --> te
    sb --> tc
    sb --> jsdoc

    fr --> if
```

## Route Discovery Algorithm

```mermaid
flowchart TD
    Start([Start]) --> FindApp[Find Express App Variable]
    FindApp --> ScopeFn[discoverRoutesInScope]

    subgraph ScopeProcessing["Recursive Scope Processing"]
        ScopeFn --> Phase1[Phase 1: Find function calls<br/>passing app/router]
        Phase1 --> Resolve[Resolve function definition]
        Resolve --> CheckVisited{Already visited?}
        CheckVisited -->|No| Recurse[Recurse into function body]
        CheckVisited -->|Yes| Skip[Skip - prevent cycle]
        Recurse --> ScopeFn

        ScopeFn --> Phase2[Phase 2: Process HTTP methods]
        Phase2 --> Methods{Method type?}
        Methods -->|get/post/put/patch/delete| Extract[Extract route info]
        Methods -->|use| Router[Extract router mount]

        Extract --> Unwrap[Unwrap wrapper functions]
        Unwrap --> AddRoute[Add to routes array]

        Router --> FollowImport[Follow imports if needed]
        FollowImport --> ComposePath[Compose base + mount path]
        ComposePath --> ScopeFn
    end

    AddRoute --> Done([Routes collected])
    Skip --> Done
```

## Type Extraction Flow

```mermaid
flowchart TD
    Handler[Handler Function Node] --> Params[Get Parameters]
    Params --> ReqParam[Request Parameter<br/>Request&lt;P, Res, Body, Query&gt;]
    Params --> ResParam[Response Parameter<br/>Response&lt;ResBody&gt;]

    ReqParam --> Extract1[Extract Type Arguments]
    Extract1 --> P[pathParams<br/>index 0]
    Extract1 --> R1[responseBody<br/>index 1]
    Extract1 --> B[bodyParams<br/>index 2]
    Extract1 --> Q[queryParams<br/>index 3]

    ResParam --> Extract2[Extract Type Argument]
    Extract2 --> R2[responseBody<br/>index 0]

    R1 --> Merge{Merge Response Types}
    R2 --> Merge

    P --> Classify
    B --> Classify
    Q --> Classify
    Merge --> Classify

    Classify{Classify Type} -->|Named| Ref[$ref to components]
    Classify -->|Utility| Expand[expandTypeToStructure]
    Classify -->|Inline| Direct[Inline in spec]

    Expand --> Convert[convertTypeToSchema]
    Ref --> Schema[OpenAPI Schema]
    Convert --> Schema
    Direct --> Schema
```

## Wrapper Unwrapping

```mermaid
flowchart TD
    Arg[Handler Argument] --> Check{Is CallExpression?}
    Check -->|Yes| IsWrapper{Matches wrapper pattern?}
    Check -->|No| IsFn{Is function-like?}

    IsWrapper -->|Yes| Depth{depth > 10?}
    IsWrapper -->|No| Return[Return null]

    Depth -->|Yes| ReturnNull[Return null<br/>prevent infinite loop]
    Depth -->|No| GetArg[Get first argument]
    GetArg --> Arg

    IsFn -->|Yes| ResolveFn[resolveFunctionNode]
    IsFn -->|No| Return

    ResolveFn --> Result[Resolved Handler]

    subgraph Patterns["Default Wrapper Patterns"]
        W1[asyncHandler]
        W2[catchAsync]
        W3[wrapAsync]
        W4[authMiddleware]
        W5[authenticate]
        W6[authorize]
        W7[validate]
        W8[withAuth]
        W9[tryCatch]
    end
```

## Spec Building Process

```mermaid
flowchart TD
    Routes[RouteInfo Array] --> Iterate[Iterate routes]

    Iterate --> Convert["Convert path format<br/>:id to #123;id#125;"]
    Convert --> ExtractTypes[extractRequestTypes]

    ExtractTypes --> PathParams[Path Parameters]
    ExtractTypes --> QueryParams[Query Parameters]
    ExtractTypes --> ReqBody[Request Body]
    ExtractTypes --> ResBody[Response Body]

    PathParams --> ConvertSchema1[convertTypeToSchema]
    QueryParams --> ConvertSchema2[convertTypeToSchema]
    ReqBody --> ConvertSchema3[convertTypeToSchema]
    ResBody --> ConvertSchema4[convertTypeToSchema]

    ConvertSchema1 --> BuildOp
    ConvertSchema2 --> BuildOp
    ConvertSchema3 --> BuildOp
    ConvertSchema4 --> BuildOp

    subgraph BuildOp["Build OperationObject"]
        OpId[operationId]
        Summary[summary from JSDoc]
        Desc[description from JSDoc]
        Params[parameters]
        ReqBodyField[requestBody]
        Responses[responses]
    end

    BuildOp --> PathItem["Group by path to PathItemObject"]
    PathItem --> Spec[OpenAPISpec]

    subgraph CompSchemas["Components"]
        Schemas[Named type schemas]
    end

    Spec --> CompSchemas
```

## Key Interfaces

```mermaid
classDiagram
    class RouteInfo {
        +string path
        +HttpMethod method
        +string handlerName
        +Node handlerNode
    }

    class RequestTypeInfo {
        +TypeInfo pathParams
        +TypeInfo responseBody
        +TypeInfo bodyParams
        +TypeInfo queryParams
    }

    class TypeInfo {
        +boolean isNamed
        +string typeName
        +string typeText
        +string resolvedTypeText
        +Node typeNode
    }

    class OpenAPISpec {
        +string openapi
        +InfoObject info
        +PathsObject paths
        +Components components
    }

    class OperationObject {
        +string operationId
        +string summary
        +string description
        +ParameterObject[] parameters
        +RequestBodyObject requestBody
        +ResponsesObject responses
    }

    RouteInfo --> RequestTypeInfo : extracted from
    RequestTypeInfo --> TypeInfo : contains
    OpenAPISpec --> OperationObject : contains
```

## File Structure

```
src/
├── index.mts              # Entry point
├── cli/
│   └── commands.mts       # CLI definition
├── core/
│   ├── orchestrator.mts   # Pipeline coordinator
│   ├── route-discovery.mts    # Find Express app
│   ├── scope-discovery.mts    # Recursive route finding
│   ├── spec-builder.mts       # Build OpenAPI spec
│   ├── type-extraction.mts    # Extract Request/Response types
│   ├── type-converter.mts     # TS → JSON Schema
│   └── jsdoc-parser.mts       # JSDoc extraction
├── ast/
│   ├── project-loader.mts     # Load ts-morph project
│   ├── express-checker.mts    # Detect Express patterns
│   ├── function-resolver.mts  # Resolve & unwrap handlers
│   └── import-follower.mts    # Follow imports
├── utils/
│   ├── path-composer.mts      # Compose route paths
│   ├── path-matcher.mts       # Ignore pattern matching
│   └── logger.mts             # Logging
└── types/
    ├── internal.mts           # Internal interfaces
    └── openapi.mts            # OpenAPI type definitions
```

## Core Modules

### CLI Layer

| Module | Purpose |
|--------|---------|
| `index.mts` | Executable entry point |
| `commands.mts` | CLI definition via Commander.js |

### Core Pipeline

| Module | Purpose |
|--------|---------|
| `orchestrator.mts` | Pipeline coordinator - loads project, discovers routes, builds spec |
| `route-discovery.mts` | Finds Express app variable, delegates to scope-discovery |
| `scope-discovery.mts` | **Main algorithm** - recursive route discovery within scopes |
| `spec-builder.mts` | Constructs OpenAPI paths/operations from routes |
| `type-extraction.mts` | Extracts types from `Request<P, Res, Body, Query>` and `Response<ResBody>` |
| `type-converter.mts` | Converts TypeScript types to JSON Schema via `typeconv` |
| `jsdoc-parser.mts` | Extracts summary/description from JSDoc comments |

### AST Utilities

| Module | Purpose |
|--------|---------|
| `project-loader.mts` | Loads TypeScript project via ts-morph |
| `express-checker.mts` | Detects `express()` and `Router()` patterns |
| `function-resolver.mts` | Resolves handlers, unwraps wrappers (asyncHandler, etc.) |
| `import-follower.mts` | Follows imports across files to resolve handlers/routers |

### Utilities

| Module | Purpose |
|--------|---------|
| `path-composer.mts` | Composes paths for nested routers |
| `path-matcher.mts` | Glob pattern matching for ignore paths |
| `logger.mts` | Structured logging with colors |

## External Dependencies

| Library | Purpose |
|---------|---------|
| **ts-morph** | TypeScript AST manipulation & type checking |
| **typeconv** | TypeScript → JSON Schema conversion |
| **commander** | CLI argument parsing |
| **winston** | Structured logging |
| **chalk** | Terminal colors |

## Key Patterns

### 1. Recursive Route Discovery
`discoverRoutesInScope()` recursively processes scopes, tracking visited functions to prevent cycles.

### 2. Wrapper Unwrapping
Handles patterns like `asyncHandler(handler)`, `authMiddleware(handler)` - unwraps up to 10 levels deep to extract inner handler types.

**Default wrapper names:** `asyncHandler`, `catchAsync`, `wrapAsync`, `authMiddleware`, `authenticate`, `authorize`, `validate`, `withAuth`, `tryCatch`

**Custom patterns via CLI:** `-w "myWrapper.*"` matches any wrapper name starting with "myWrapper"

### 3. Router Mounting
Follows `app.use(path, router)` calls, composing full paths from nested routers.

### 4. Import Following
Resolves handlers/routers across files via named and default imports.

### 5. Type Extraction
Uses TypeScript's typeChecker to resolve complex types:
- Utility types: `Partial<T>`, `Pick<T>`, `Omit<T>`, `Record<K,V>`
- Union/intersection types: `A | B`, `A & B`
- Zod inferred types: `z.infer<typeof Schema>`
- Nested types with circular reference detection

### 6. Component Schemas
Named types extracted to `components.schemas` with `$ref` references.

## Known Limitations

- Dynamic/runtime-generated routes not supported
- No decorator support currently
- Deeply nested conditional types may not fully resolve
- Max wrapper unwrapping depth: 10 levels
