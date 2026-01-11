import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateOpenApiSpec } from "../../src/core/orchestrator.mjs";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const FIXTURES_DIR = join(process.cwd(), "test", "fixtures", "error-handling");

describe("Error Handling", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create test fixtures directory
    mkdirSync(FIXTURES_DIR, { recursive: true });

    // Spy on console.warn
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up test fixtures
    rmSync(FIXTURES_DIR, { recursive: true, force: true });

    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  describe("Missing Type Information", () => {
    it("should warn when route handler has no type annotations", async () => {
      // Create a server with untyped handler
      writeFileSync(
        join(FIXTURES_DIR, "untyped-server.ts"),
        `
        import express from 'express';

        const app = express();

        // Handler with no type information
        function getUsers(req, res) {
          res.json([]);
        }

        app.get('/users', getUsers);
        `,
      );

      const spec = await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "untyped-server.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      // Should still generate spec but warn
      expect(spec.paths["/users"]).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Route GET /users has no type information"),
      );
    });

    it("should not warn when route has type information", async () => {
      // Create a server with typed handler
      writeFileSync(
        join(FIXTURES_DIR, "typed-server.ts"),
        `
        import express, { Request, Response } from 'express';

        const app = express();

        function getUsers(req: Request, res: Response) {
          res.json([]);
        }

        app.get('/users', getUsers);
        `,
      );

      await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "typed-server.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      // Should not warn
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should warn when inline handler has no types", async () => {
      writeFileSync(
        join(FIXTURES_DIR, "inline-untyped.ts"),
        `
        import express from 'express';

        const app = express();

        app.get('/users', (req, res) => {
          res.json([]);
        });
        `,
      );

      await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "inline-untyped.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Route GET /users has no type information"),
      );
    });
  });

  describe("Circular Import Detection", () => {
    it("should handle circular imports gracefully", async () => {
      // Create file A that imports B
      writeFileSync(
        join(FIXTURES_DIR, "file-a.ts"),
        `
        import express from 'express';
        import { handlerB } from './file-b';

        const app = express();

        function handlerA(req: express.Request, res: express.Response) {
          res.json({ from: 'A' });
        }

        app.get('/a', handlerA);
        app.get('/b', handlerB);

        export { handlerA };
        `,
      );

      // Create file B that imports A (circular)
      writeFileSync(
        join(FIXTURES_DIR, "file-b.ts"),
        `
        import express from 'express';
        import { handlerA } from './file-a';

        function handlerB(req: express.Request, res: express.Response) {
          res.json({ from: 'B' });
        }

        export { handlerB };
        `,
      );

      // Should not throw, should handle gracefully
      const spec = await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "file-a.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      expect(spec.paths["/a"]).toBeDefined();
      expect(spec.paths["/b"]).toBeDefined();
    });
  });

  describe("Error Messages", () => {
    it("should provide helpful message for non-existent entry point", async () => {
      await expect(
        generateOpenApiSpec({
          entryPoint: join(FIXTURES_DIR, "non-existent.ts"),
          title: "Test API",
          version: "1.0.0",
        }),
      ).rejects.toThrow("Entry point file not found");
    });

    it("should handle routes with complex inline types", async () => {
      writeFileSync(
        join(FIXTURES_DIR, "complex-types.ts"),
        `
        import express, { Request, Response } from 'express';

        const app = express();

        function createUser(
          req: Request<{}, {}, {
            name: string;
            email: string;
            nested: { value: number }
          }>,
          res: Response
        ) {
          res.json({ id: 1 });
        }

        app.post('/users', createUser);
        `,
      );

      // Should not throw
      const spec = await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "complex-types.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      expect(spec.paths["/users"].post).toBeDefined();
    });

    it("should handle empty Express app without warnings", async () => {
      writeFileSync(
        join(FIXTURES_DIR, "empty-app.ts"),
        `
        import express from 'express';

        const app = express();

        // No routes defined
        `,
      );

      const spec = await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "empty-app.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      expect(Object.keys(spec.paths)).toHaveLength(0);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("Type Extraction Errors", () => {
    it("should warn when type extraction fails for complex types", async () => {
      writeFileSync(
        join(FIXTURES_DIR, "complex-type-error.ts"),
        `
        import express, { Request, Response } from 'express';

        const app = express();

        // Handler with valid types
        function getUser(req: Request<{ id: string }>, res: Response) {
          res.json({ id: 1 });
        }

        app.get('/users/:id', getUser);
        `,
      );

      const spec = await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "complex-type-error.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      // Should still generate spec
      expect(spec.paths["/users/{id}"]).toBeDefined();
    });
  });

  describe("Multiple Warnings", () => {
    it("should collect and report multiple warnings", async () => {
      writeFileSync(
        join(FIXTURES_DIR, "multiple-warnings.ts"),
        `
        import express, { Request, Response } from 'express';

        const app = express();

        // Untyped handler 1
        function getUsers(req, res) {
          res.json([]);
        }

        // Untyped handler 2
        function getPosts(req, res) {
          res.json([]);
        }

        // Typed handler
        function getComments(req: Request, res: Response) {
          res.json([]);
        }

        app.get('/users', getUsers);
        app.get('/posts', getPosts);
        app.get('/comments', getComments);
        `,
      );

      await generateOpenApiSpec({
        entryPoint: join(FIXTURES_DIR, "multiple-warnings.ts"),
        title: "Test API",
        version: "1.0.0",
      });

      // Should warn for both untyped routes
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("GET /users"),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("GET /posts"),
      );
    });
  });
});
