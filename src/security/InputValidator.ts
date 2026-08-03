/**
 * Input Validator — Enterprise validation framework for user & API input.
 * Prevents injection attacks, enforces business rules, provides detailed errors.
 */

export type ValidationRuleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'email'
  | 'url'
  | 'uuid'
  | 'iso-date'
  | 'custom';

export interface ValidationRule {
  type: ValidationRuleType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: (string | number)[];
  custom?: (value: unknown) => boolean | Promise<boolean>;
  message?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  value: unknown;
  rule: ValidationRuleType;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: Record<string, unknown>;
}

/**
 * Core validator with type-safe validation rules.
 */
export class InputValidator {
  private static readonly EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private static readonly ISO_DATE_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

  private static readonly URL_PATTERN =
    /^https?:\/\/.+/i;

  /**
   * Validate input against a schema.
   */
  static async validate(
    input: unknown,
    schema: ValidationSchema
  ): Promise<ValidationResult> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {
        valid: false,
        errors: [{
          field: '$root',
          value: input,
          rule: 'custom',
          message: 'Input must be an object'
        }]
      };
    }

    const errors: ValidationError[] = [];
    const data: Record<string, unknown> = {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = (input as Record<string, unknown>)[field];
      const fieldErrors = await this.validateField(field, value, rule);
      errors.push(...fieldErrors);
      if (fieldErrors.length === 0) {
        data[field] = value;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : undefined
    };
  }

  /**
   * Validate a single field against a rule.
   */
  private static async validateField(
    field: string,
    value: unknown,
    rule: ValidationRule
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        value,
        rule: rule.type,
        message: rule.message || `${field} is required`
      });
      return errors;
    }

    // If not required and empty, skip other validations
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return errors;
    }

    // Type-specific validations
    switch (rule.type) {
      case 'string':
        errors.push(...this.validateString(field, value, rule));
        break;

      case 'number':
        errors.push(...this.validateNumber(field, value, rule));
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field,
            value,
            rule: 'boolean',
            message: rule.message || `${field} must be boolean`
          });
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !this.EMAIL_PATTERN.test(value)) {
          errors.push({
            field,
            value,
            rule: 'email',
            message: rule.message || `${field} must be a valid email`
          });
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !this.URL_PATTERN.test(value)) {
          errors.push({
            field,
            value,
            rule: 'url',
            message: rule.message || `${field} must be a valid URL`
          });
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !this.UUID_PATTERN.test(value)) {
          errors.push({
            field,
            value,
            rule: 'uuid',
            message: rule.message || `${field} must be a valid UUID`
          });
        }
        break;

      case 'iso-date':
        if (typeof value !== 'string' || !this.ISO_DATE_PATTERN.test(value)) {
          errors.push({
            field,
            value,
            rule: 'iso-date',
            message: rule.message || `${field} must be ISO 8601 date`
          });
        }
        break;

      case 'custom':
        if (rule.custom) {
          const isValid = await rule.custom(value);
          if (!isValid) {
            errors.push({
              field,
              value,
              rule: 'custom',
              message: rule.message || `${field} is invalid`
            });
          }
        }
        break;
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value as never)) {
      errors.push({
        field,
        value,
        rule: rule.type,
        message: rule.message || `${field} must be one of: ${rule.enum.join(', ')}`
      });
    }

    return errors;
  }

  /**
   * Validate string value.
   */
  private static validateString(
    field: string,
    value: unknown,
    rule: ValidationRule
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== 'string') {
      errors.push({
        field,
        value,
        rule: 'string',
        message: rule.message || `${field} must be a string`
      });
      return errors;
    }

    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push({
        field,
        value,
        rule: 'string',
        message: rule.message || `${field} must be at least ${rule.minLength} characters`
      });
    }

    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push({
        field,
        value,
        rule: 'string',
        message: rule.message || `${field} must be at most ${rule.maxLength} characters`
      });
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({
        field,
        value,
        rule: 'string',
        message: rule.message || `${field} format is invalid`
      });
    }

    return errors;
  }

  /**
   * Validate number value.
   */
  private static validateNumber(
    field: string,
    value: unknown,
    rule: ValidationRule
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push({
        field,
        value,
        rule: 'number',
        message: rule.message || `${field} must be a number`
      });
      return errors;
    }

    if (rule.min !== undefined && value < rule.min) {
      errors.push({
        field,
        value,
        rule: 'number',
        message: rule.message || `${field} must be >= ${rule.min}`
      });
    }

    if (rule.max !== undefined && value > rule.max) {
      errors.push({
        field,
        value,
        rule: 'number',
        message: rule.message || `${field} must be <= ${rule.max}`
      });
    }

    return errors;
  }

  /**
   * Validate and throw if invalid.
   */
  static async validateOrThrow(
    input: unknown,
    schema: ValidationSchema
  ): Promise<Record<string, unknown>> {
    const result = await this.validate(input, schema);
    if (!result.valid) {
      throw new ValidationErrorClass(result.errors);
    }
    return result.data!;
  }
}

/**
 * Custom error class for validation failures.
 */
export class ValidationErrorClass extends Error {
  constructor(public errors: ValidationError[]) {
    super(`Validation failed: ${errors.length} error(s)`);
    this.name = 'ValidationError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors
    };
  }
}
