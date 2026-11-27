# Development

Work from the repository root with the Node version in `.nvmrc` and the dependencies pinned in `package-lock.json`.

1. Install the locked dependencies with `npm ci`.
2. Start the local Vite server with `npm run dev`.
3. Make a scoped change and run its focused checks. For example, `make test TEST_ARGS='src/home/modalLayout.test.ts'` runs one test file in isolation.
4. Run `make check` for the complete project gate when the change is ready for integration.

The [development reference](../reference/development.md) lists commands, resource admission, output exports, source layout and dependency workarounds. [Delivery](../reference/delivery.md) describes the existing runner; local checks do not publish or deploy.

## Navigation

[Guides](README.md) · [Development reference](../reference/development.md) · [Documentation](../README.md) · [Project](../../README.md)
