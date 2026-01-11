import { describe, it, expect } from 'vitest';
import { shouldIgnorePath, matchesPattern } from '../../src/utils/path-matcher.mjs';

describe('Path Matcher', () => {
  describe('matchesPattern', () => {
    it('should match exact paths', () => {
      expect(matchesPattern('/users', '/users')).toBe(true);
      expect(matchesPattern('/api/users', '/api/users')).toBe(true);
    });

    it('should not match different paths', () => {
      expect(matchesPattern('/users', '/posts')).toBe(false);
      expect(matchesPattern('/api/users', '/api/posts')).toBe(false);
    });

    it('should match single wildcard (*) patterns', () => {
      // * matches any characters except /
      expect(matchesPattern('/admin/stats', '/admin/*')).toBe(true);
      expect(matchesPattern('/admin/users', '/admin/*')).toBe(true);
      expect(matchesPattern('/api/v1', '/api/*')).toBe(true);
    });

    it('should not match single wildcard across slashes', () => {
      // * should not match across path separators
      expect(matchesPattern('/admin/internal/stats', '/admin/*')).toBe(false);
      expect(matchesPattern('/api/v1/users', '/api/*')).toBe(false);
    });

    it('should match double wildcard (**) patterns', () => {
      // ** matches any characters including /
      expect(matchesPattern('/admin/stats', '/admin/**')).toBe(true);
      expect(matchesPattern('/admin/internal/stats', '/admin/**')).toBe(true);
      expect(matchesPattern('/admin/a/b/c/d', '/admin/**')).toBe(true);
    });

    it('should not match wildcard at beginning without leading slash', () => {
      // * doesn't match / so */users won't match /api/users
      expect(matchesPattern('/api/users', '*/users')).toBe(false);
      expect(matchesPattern('/v1/users', '*/users')).toBe(false);
      // But it works with proper leading slash
      expect(matchesPattern('/api/users', '/*/users')).toBe(true);
    });

    it('should match wildcard in middle', () => {
      expect(matchesPattern('/api/v1/users', '/api/*/users')).toBe(true);
      expect(matchesPattern('/api/v2/users', '/api/*/users')).toBe(true);
    });

    it('should match multiple wildcards', () => {
      expect(matchesPattern('/api/v1/users/123', '/api/*/users/*')).toBe(true);
      expect(matchesPattern('/api/v2/posts/456', '/api/*/posts/*')).toBe(true);
    });

    it('should handle special regex characters in patterns', () => {
      // Dots are escaped and match literally
      expect(matchesPattern('/api/v1.0/users', '/api/v1.0/users')).toBe(true);
      expect(matchesPattern('/api/v1X0/users', '/api/v1.0/users')).toBe(false);

      // Special characters are escaped
      expect(matchesPattern('/api/users', '/api/users')).toBe(true);
      expect(matchesPattern('/users(test)', '/users(test)')).toBe(true);
    });

    it('should be case sensitive', () => {
      expect(matchesPattern('/Admin/stats', '/admin/stats')).toBe(false);
      expect(matchesPattern('/admin/stats', '/Admin/stats')).toBe(false);
    });

    it('should match path with parameters', () => {
      expect(matchesPattern('/users/123', '/users/*')).toBe(true);
      expect(matchesPattern('/users/{id}', '/users/*')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(matchesPattern('/', '/')).toBe(true);
      expect(matchesPattern('/users', '*')).toBe(false); // * doesn't match /
      expect(matchesPattern('/users', '**')).toBe(true); // ** matches everything including /
      expect(matchesPattern('', '')).toBe(true);
      expect(matchesPattern('/a/b/c', '**')).toBe(true); // ** matches any depth
    });
  });

  describe('shouldIgnorePath', () => {
    it('should return false when no patterns provided', () => {
      expect(shouldIgnorePath('/users', [])).toBe(false);
    });

    it('should return true when path matches exact pattern', () => {
      expect(shouldIgnorePath('/admin/stats', ['/admin/stats'])).toBe(true);
    });

    it('should return true when path matches wildcard pattern', () => {
      expect(shouldIgnorePath('/admin/stats', ['/admin/*'])).toBe(true);
      expect(shouldIgnorePath('/internal/users', ['/internal/*'])).toBe(true);
    });

    it('should return true when path matches double wildcard pattern', () => {
      expect(shouldIgnorePath('/admin/internal/stats', ['/admin/**'])).toBe(true);
    });

    it('should return false when path does not match any pattern', () => {
      expect(shouldIgnorePath('/users', ['/admin/*'])).toBe(false);
      expect(shouldIgnorePath('/api/users', ['/internal/*', '/admin/*'])).toBe(false);
    });

    it('should return true when path matches any pattern in array', () => {
      const patterns = ['/admin/*', '/internal/*', '/test/**'];
      expect(shouldIgnorePath('/admin/stats', patterns)).toBe(true);
      expect(shouldIgnorePath('/internal/debug', patterns)).toBe(true);
      expect(shouldIgnorePath('/test/a/b/c', patterns)).toBe(true);
      expect(shouldIgnorePath('/users', patterns)).toBe(false);
    });

    it('should handle multiple patterns correctly', () => {
      const patterns = ['/admin/**', '/internal/*', '/health'];
      expect(shouldIgnorePath('/admin/stats', patterns)).toBe(true);
      expect(shouldIgnorePath('/admin/a/b/c', patterns)).toBe(true);
      expect(shouldIgnorePath('/internal/debug', patterns)).toBe(true);
      expect(shouldIgnorePath('/health', patterns)).toBe(true);
      expect(shouldIgnorePath('/users', patterns)).toBe(false);
      expect(shouldIgnorePath('/api/users', patterns)).toBe(false);
    });

    it('should handle empty patterns array', () => {
      expect(shouldIgnorePath('/any/path', [])).toBe(false);
    });

    it('should work with real-world patterns', () => {
      const patterns = ['/docs/**', '/swagger/**', '/_internal/*', '/health', '/metrics'];

      // Should ignore
      expect(shouldIgnorePath('/docs', patterns)).toBe(false); // exact match needed
      expect(shouldIgnorePath('/docs/api', patterns)).toBe(true);
      expect(shouldIgnorePath('/docs/api/v1/users', patterns)).toBe(true);
      expect(shouldIgnorePath('/swagger/ui', patterns)).toBe(true);
      expect(shouldIgnorePath('/_internal/debug', patterns)).toBe(true);
      expect(shouldIgnorePath('/health', patterns)).toBe(true);
      expect(shouldIgnorePath('/metrics', patterns)).toBe(true);

      // Should not ignore
      expect(shouldIgnorePath('/api/users', patterns)).toBe(false);
      expect(shouldIgnorePath('/users', patterns)).toBe(false);
      expect(shouldIgnorePath('/_internal/debug/stats', patterns)).toBe(false); // * doesn't match /
    });
  });
});
