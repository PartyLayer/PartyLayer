# Registry Test Fixtures

Test fixtures for registry security tests.

## Structure

- `valid/` - Valid registry files (signed correctly)
- `tampered/` - Tampered registry files (1 byte modified)
- `downgrade/` - Registry files with lower sequence numbers

## Usage

These fixtures are used by:
- Unit tests: `packages/registry-client/src/client.test.ts`
- Security tests: `apps/demo/e2e/security.spec.ts`

## Generating Fixtures

Fixtures are generated from the actual registry files in `registry/v1/`:

```bash
# Copy valid registry
cp registry/v1/stable/registry.json fixtures/registry/valid/stable.json
cp registry/v1/stable/registry.sig fixtures/registry/valid/stable.sig

# Create tampered version (modify 1 byte)
node scripts/fixtures/tamper.js fixtures/registry/valid/stable.json fixtures/registry/tampered/stable.json

# Create downgrade version (lower sequence)
node scripts/fixtures/downgrade.js fixtures/registry/valid/stable.json fixtures/registry/downgrade/stable.json
```
