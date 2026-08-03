import { describe, it, expect, beforeEach } from 'vitest';
import {
  InputValidator,
  ValidationSchema,
  ValidationErrorClass
} from '../../src/security/InputValidator';

describe('InputValidator', () => {
  describe('validate', () => {
    it('validates required string fields', async () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true }
      };

      const result = await InputValidator.validate({ name: 'John' }, schema);
      expect(result.valid).toBe(true);
      expect(result.data?.name).toBe('John');
    });

    it('rejects missing required fields', async () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true }
      };

      const result = await InputValidator.validate({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
    });

    it('validates email format', async () => {
      const schema: ValidationSchema = {
        email: { type: 'email', required: true }
      };

      const valid = await InputValidator.validate(
        { email: 'test@example.com' },
        schema
      );
      expect(valid.valid).toBe(true);

      const invalid = await InputValidator.validate(
        { email: 'not-an-email' },
        schema
      );
      expect(invalid.valid).toBe(false);
    });

    it('validates UUID format', async () => {
      const schema: ValidationSchema = {
        id: { type: 'uuid', required: true }
      };

      const valid = await InputValidator.validate(
        { id: '550e8400-e29b-41d4-a716-446655440000' },
        schema
      );
      expect(valid.valid).toBe(true);

      const invalid = await InputValidator.validate(
        { id: 'not-a-uuid' },
        schema
      );
      expect(invalid.valid).toBe(false);
    });

    it('validates number ranges', async () => {
      const schema: ValidationSchema = {
        age: { type: 'number', min: 0, max: 150 }
      };

      const valid = await InputValidator.validate({ age: 25 }, schema);
      expect(valid.valid).toBe(true);

      const tooSmall = await InputValidator.validate({ age: -1 }, schema);
      expect(tooSmall.valid).toBe(false);

      const tooLarge = await InputValidator.validate({ age: 200 }, schema);
      expect(tooLarge.valid).toBe(false);
    });

    it('validates string length', async () => {
      const schema: ValidationSchema = {
        password: { type: 'string', minLength: 8, maxLength: 64 }
      };

      const valid = await InputValidator.validate(
        { password: 'securePassword123' },
        schema
      );
      expect(valid.valid).toBe(true);

      const tooShort = await InputValidator.validate(
        { password: 'short' },
        schema
      );
      expect(tooShort.valid).toBe(false);

      const tooLong = await InputValidator.validate(
        { password: 'a'.repeat(65) },
        schema
      );
      expect(tooLong.valid).toBe(false);
    });

    it('validates enum values', async () => {
      const schema: ValidationSchema = {
        role: { type: 'string', enum: ['admin', 'user', 'viewer'] }
      };

      const valid = await InputValidator.validate(
        { role: 'admin' },
        schema
      );
      expect(valid.valid).toBe(true);

      const invalid = await InputValidator.validate(
        { role: 'superuser' },
        schema
      );
      expect(invalid.valid).toBe(false);
    });

    it('validates custom rules', async () => {
      const schema: ValidationSchema = {
        username: {
          type: 'custom',
          custom: async (value) => {
            const str = value as string;
            return /^[a-z0-9_]{3,20}$/.test(str);
          }
        }
      };

      const valid = await InputValidator.validate(
        { username: 'john_doe' },
        schema
      );
      expect(valid.valid).toBe(true);

      const invalid = await InputValidator.validate(
        { username: 'j' },
        schema
      );
      expect(invalid.valid).toBe(false);
    });

    it('allows optional fields to be empty', async () => {
      const schema: ValidationSchema = {
        optional: { type: 'string', required: false },
        required: { type: 'string', required: true }
      };

      const result = await InputValidator.validate(
        { required: 'value' },
        schema
      );
      expect(result.valid).toBe(true);
    });

    it('rejects non-object input', async () => {
      const schema: ValidationSchema = {
        name: { type: 'string' }
      };

      const result = await InputValidator.validate('not an object', schema);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateOrThrow', () => {
    it('throws on invalid input', async () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true }
      };

      await expect(
        InputValidator.validateOrThrow({}, schema)
      ).rejects.toThrow(ValidationErrorClass);
    });

    it('returns data on valid input', async () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true }
      };

      const data = await InputValidator.validateOrThrow(
        { name: 'John' },
        schema
      );
      expect(data.name).toBe('John');
    });
  });

  describe('ISO date validation', () => {
    it('validates ISO 8601 dates', async () => {
      const schema: ValidationSchema = {
        date: { type: 'iso-date' }
      };

      const valid = await InputValidator.validate(
        { date: '2026-07-23T12:00:00Z' },
        schema
      );
      expect(valid.valid).toBe(true);

      const invalid = await InputValidator.validate(
        { date: '2026-07-23' },
        schema
      );
      expect(invalid.valid).toBe(false);
    });
  });

  describe('URL validation', () => {
    it('validates URLs', async () => {
      const schema: ValidationSchema = {
        url: { type: 'url' }
      };

      const valid = await InputValidator.validate(
        { url: 'https://example.com' },
        schema
      );
      expect(valid.valid).toBe(true);

      const invalid = await InputValidator.validate(
        { url: 'not-a-url' },
        schema
      );
      expect(invalid.valid).toBe(false);
    });
  });
});
