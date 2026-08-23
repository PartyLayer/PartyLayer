## Handoff

<!-- So a reviewer can fetch the exact ref instead of guessing it. Fill with:
     git rev-parse --abbrev-ref HEAD; git rev-parse HEAD; git rev-parse origin/main
     git diff --numstat origin/main...HEAD -->

```
branch:
head sha:
base sha:
files:
```

Supersedes / follows: <!-- #NNN, or delete this line -->

## Summary

<!-- What changes, and why. -->

## Related issues

<!-- Link any related issues. -->

## Checklist

- [ ] Full gate passes (`pnpm gate`), which runs the api and packaging snapshot checks the commands below do not
- [ ] Tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Documentation updated (if needed)
- [ ] Changeset added (for package changes)
- [ ] Wallet related change: the wallet integrates through Path A or Path B and adds no package under `packages/adapters` (see <https://partylayer.xyz/docs/generic-bridge>)
