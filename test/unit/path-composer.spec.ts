import { describe, it, expect } from 'vitest';
import { composePath } from '../../src/utils/path-composer.mjs';

describe('Path Composer', () => {
  it('should handle empty base path', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('', '/users')).toBe('/users');
  });

  it('should handle root base path', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/', '/users')).toBe('/users');
  });

  it('should compose base and route paths', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api', '/users')).toBe('/api/users');
  });

  it('should handle route path without leading slash', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api', 'users')).toBe('/api/users');
  });

  it('should handle base path with trailing slash', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api/', '/users')).toBe('/api/users');
  });

  it('should handle both trailing and leading slashes', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api/', 'users')).toBe('/api/users');
  });

  it('should handle complex paths with parameters', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api/v1', '/users/:id')).toBe('/api/v1/users/:id');
  });

  it('should handle nested base paths', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api/v1/admin', '/users')).toBe('/api/v1/admin/users');
  });

  it('should handle empty route path', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api', '')).toBe('/api');
  });

  it('should handle root route path', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('/api', '/')).toBe('/api');
  });

  it('should handle both empty paths', () => {
    // ARRANGE & ACT & ASSERT
    expect(composePath('', '')).toBe('/');
  });
});
