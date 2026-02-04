import { validate, registerApiKeySchema, githubUrlSchema, paginationSchema } from '../../../src/utils/validators';
import { ValidationError } from '../../../src/utils/errors';

describe('Validators', () => {
  describe('registerApiKeySchema', () => {
    it('should validate correct email', () => {
      const data = { email: 'test@example.com' };
      const result = validate(registerApiKeySchema)(data);
      expect(result.email).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      const data = { email: 'invalid-email' };
      expect(() => validate(registerApiKeySchema)(data)).toThrow(ValidationError);
    });

    it('should accept optional name', () => {
      const data = { email: 'test@example.com', name: 'My Key' };
      const result = validate(registerApiKeySchema)(data);
      expect(result.name).toBe('My Key');
    });

    it('should use default tier', () => {
      const data = { email: 'test@example.com' };
      const result = validate(registerApiKeySchema)(data);
      expect(result.tier).toBe('free');
    });

    it('should validate tier enum', () => {
      const data = { email: 'test@example.com', tier: 'invalid' };
      expect(() => validate(registerApiKeySchema)(data)).toThrow(ValidationError);
    });
  });

  describe('githubUrlSchema', () => {
    it('should validate correct GitHub URL', () => {
      const url = 'https://github.com/facebook/react';
      const result = validate(githubUrlSchema)(url);
      expect(result).toBe(url);
    });

    it('should reject non-GitHub URL', () => {
      const url = 'https://gitlab.com/test/repo';
      expect(() => validate(githubUrlSchema)(url)).toThrow(ValidationError);
    });

    it('should reject invalid URL format', () => {
      const url = 'not-a-url';
      expect(() => validate(githubUrlSchema)(url)).toThrow(ValidationError);
    });

    it('should accept GitHub URL with .git', () => {
      const url = 'https://github.com/test/repo.git';
      const result = validate(githubUrlSchema)(url);
      expect(result).toBe(url);
    });
  });

  describe('paginationSchema', () => {
    it('should use default values', () => {
      const result = validate(paginationSchema)({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should validate custom page', () => {
      const result = validate(paginationSchema)({ page: '5' });
      expect(result.page).toBe(5);
    });

    it('should validate custom limit', () => {
      const result = validate(paginationSchema)({ limit: '50' });
      expect(result.limit).toBe(50);
    });

    it('should reject limit over 100', () => {
      expect(() => validate(paginationSchema)({ limit: '150' })).toThrow(ValidationError);
    });

    it('should reject negative page', () => {
      expect(() => validate(paginationSchema)({ page: '-1' })).toThrow(ValidationError);
    });
  });
});