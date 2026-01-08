# express-to-openapi2

The goal of this project is to build a cli tool that takes an "entry point" typescript file of an express server, and builds an openapi spec from it. It should this by parsing the typescript code and understanding the types of each route handler.

## Workflow and code conventions

- always add tests and test cases first. For unit tests and small examples, you can create the code base directly as strings and use ts-morph to create the project.
- For longer examples, create a fixture in `test/fixtures`
- avoid long functions, split to smaller functions wherever you can.
- only comment on complicated logic. Otherwise, prefer smaller function with self-explanatory name.
- prefer functional style .map(), .reduce, and .forEach() over loops
- follow "imperative shell, functional core" style.

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
