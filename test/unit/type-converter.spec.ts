import { describe, it, expect } from 'vitest';
import { convertTypeToSchema } from '../../src/core/type-converter.mjs';

describe('Type Converter', () => {
  describe('7.7: TypeScript to OpenAPI Schema Conversion', () => {
    it('should convert simple object type', async () => {
      // ARRANGE
      const typeText = '{ name: string; age: number }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties?.name).toEqual({ type: 'string' });
      expect(schema.properties?.age).toEqual({ type: 'number' });
      expect(schema.required).toEqual(['name', 'age']);
    });

    it('should handle optional properties', async () => {
      // ARRANGE
      const typeText = '{ name: string; age?: number }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.required).toEqual(['name']);
      expect(schema.properties?.age).toBeDefined();
    });

    it('should convert array types', async () => {
      // ARRANGE
      const typeText = '{ tags: string[] }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.properties?.tags).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should convert nested objects', async () => {
      // ARRANGE
      const typeText = '{ user: { name: string } }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.properties?.user).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
    });

    it('should handle boolean types', async () => {
      // ARRANGE
      const typeText = '{ active: boolean }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.properties?.active).toEqual({ type: 'boolean' });
    });

    it('should handle number types', async () => {
      // ARRANGE
      const typeText = '{ count: number }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.properties?.count).toEqual({ type: 'number' });
    });

    it('should handle empty object type', async () => {
      // ARRANGE
      const typeText = '{}';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.type).toBe('object');
      expect(schema.properties).toEqual({});
    });

    it('should handle complex nested types', async () => {
      // ARRANGE
      const typeText = '{ items: Array<{ id: string; count: number }> }';

      // ACT
      const schema = await convertTypeToSchema(typeText);

      // ASSERT
      expect(schema.properties?.items).toMatchObject({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            count: { type: 'number' },
          },
        },
      });
    });
  });
});
