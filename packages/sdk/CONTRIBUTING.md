# Contributing to RealSyncDynamics SDK

Thank you for interest in contributing to the RealSyncDynamics TypeScript SDK! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites
- Node.js 16+
- npm, yarn, or pnpm

### Local Development

1. Clone the repository
```bash
git clone https://github.com/realsyncdynamics/sdk-ts.git
cd sdk-ts/packages/sdk
```

2. Install dependencies
```bash
npm install
```

3. Build the SDK
```bash
npm run build
```

4. Run tests
```bash
npm test
```

5. Watch mode for development
```bash
npm run test:watch
```

## Code Style & Standards

- **Language**: TypeScript with strict mode enabled
- **Format**: Follow existing code patterns and indentation
- **Comments**: Only add comments for non-obvious logic or complex algorithms
- **Types**: All functions must have explicit type signatures
- **Naming**: Use clear, descriptive names for functions and variables

## Making Changes

### File Structure
```
packages/sdk/
├── src/
│   ├── client.ts          # Main SDK client
│   ├── types.ts           # Type definitions
│   └── index.ts           # Barrel export
├── test/
│   ├── client.test.ts     # Client tests
│   └── types.test.ts      # Type validation tests
├── examples/
│   ├── quick-start.ts
│   ├── webhook-integration.ts
│   ├── alert-rules.ts
│   └── tenant-config.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### Adding New Methods

When adding a new SDK method:

1. Define the request/response types in `src/types.ts`
2. Implement the method in `src/client.ts` using the private `request()` method
3. Add corresponding test cases in `test/client.test.ts`
4. Document the method in `README.md` with:
   - Method signature
   - Description
   - Example usage
5. Create an example file if it's a major feature

### Example Method Implementation

```typescript
async myNewMethod(
  tenantId: string,
  options?: MyOptions
): Promise<MyResult> {
  return this.request('GET', `/tenants/${tenantId}/my-resource`, {
    query: options,
  });
}
```

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- client.test.ts

# Generate coverage report
npm test -- --coverage
```

### Writing Tests

- Use Vitest for all tests
- Mock external dependencies (fetch, API calls)
- Test happy path, error cases, and edge cases
- Aim for high coverage (>80%)

Example test pattern:
```typescript
describe('MyFeature', () => {
  it('should do X when given Y', async () => {
    // Arrange
    const mockResponse = { /* ... */ };
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    // Act
    const result = await sdk.myMethod('tenant-1');

    // Assert
    expect(result).toEqual(mockResponse);
  });
});
```

## Linting & Type Checking

```bash
# Check types
npm run lint

# Format code (if configured)
npm run format
```

## Building

### Build Commands

```bash
# Build all targets (CommonJS, ESM, declarations)
npm run build

# Build only CommonJS
npm run build:cjs

# Build only ESM
npm run build:esm

# Build only TypeScript declarations
npm run build:types
```

### Build Output

The build process generates:
- `dist/cjs/` - CommonJS modules (require)
- `dist/esm/` - ES modules (import)
- `dist/index.d.ts` - TypeScript declarations

## Publishing

### Pre-Publication Checklist

- [ ] All tests pass: `npm test`
- [ ] Type checking passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Test package locally: `npm pack --dry-run`
- [ ] Update version in `package.json`
- [ ] Update `README.md` if needed
- [ ] Create changelog entry

### Publish to npm

**Only maintainers can publish:**

```bash
npm login  # Use your npm credentials
npm publish
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit with clear messages:
   ```
   feat(client): add new method
   
   - Description of what was added
   - Why it was needed
   ```
4. Push to your fork: `git push origin feature/my-feature`
5. Open a Pull Request with:
   - Clear title and description
   - Link to any related issues
   - Summary of changes
   - Test results

### PR Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Added/updated tests
- [ ] All tests pass
- [ ] Manual testing completed

## Checklist
- [ ] TypeScript types are correct
- [ ] Code follows style guidelines
- [ ] README is updated if needed
- [ ] No breaking changes (or documented)
```

## Reporting Issues

Report bugs and feature requests via GitHub Issues with:
- Clear title and description
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Environment info (Node version, OS, etc.)
- Code examples if applicable

## Code Review Guidelines

Reviewers look for:
- Correct implementation of requirements
- Proper error handling
- Type safety
- Test coverage
- Documentation clarity
- No breaking changes

## Performance Considerations

- Minimize bundle size
- Cache responses where appropriate
- Implement rate limiting awareness
- Document timeout values

## Documentation

All public APIs must be documented with:
- JSDoc comments in code
- Method examples in README
- Type definitions clearly labeled
- Error scenarios explained

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Report via GitHub Issues
- **Security**: Email security@realsyncdynamics.ai
- **Support**: Email support@realsyncdynamics.ai

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to RealSyncDynamics SDK! 🎉
