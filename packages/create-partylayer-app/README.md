# create-partylayer-app

Scaffold a [PartyLayer](https://partylayer.xyz) dApp — Canton wallet integration — in seconds.

```bash
npm create partylayer-app@latest
# or
pnpm create partylayer-app
# or
yarn create partylayer-app
```

Then follow the prompts (project directory → template → package manager).

## Non-interactive

Pass flags to skip the prompts (useful in CI):

```bash
npm create partylayer-app@latest my-app -- --template react-vite --pm npm
```

| Flag | Description |
| --- | --- |
| `<dir>` | Target directory (positional) |
| `-t, --template <id>` | Template to use (`react-vite`) |
| `--pm <manager>` | `npm` \| `pnpm` \| `yarn` |
| `--no-install` | Skip dependency install |
| `--no-git` | Skip git init |
| `-h, --help` | Show help |

## Templates

| Template | Stack |
| --- | --- |
| `react-vite` | React 18 + Vite + zero-config `PartyLayerKit` |

More templates (Next SSR, Vue/Nuxt/Pinia, Vanilla) are on the way.

## License

MIT
