# CantonConnect Registry Server

Minimal production-ready server for serving wallet registry files.

## Usage

### Development

```bash
# Install dependencies
pnpm install

# Run in dev mode
pnpm dev

# Or build and run
pnpm build
pnpm start
```

### Production

```bash
# Set environment variables
export PORT=3001
export REGISTRY_DIR=/path/to/registry

# Run server
pnpm start
```

### Static Hosting Mode

For Vercel/Netlify/static hosting:

```bash
DEPLOY_MODE=static pnpm start
```

This prints the file locations that should be served by your CDN.

## Endpoints

- `GET /health` - Health check
- `GET /v1/:channel/registry.json` - Registry JSON (channels: stable, beta)
- `GET /v1/:channel/registry.sig` - Registry signature (channels: stable, beta)

## Environment Variables

- `PORT` - Server port (default: 3001)
- `REGISTRY_DIR` - Path to registry directory (default: ../../registry)
- `DEPLOY_MODE` - If "static", prints file locations and exits

## Security Features

- ETag support for efficient caching
- Proper Content-Type headers
- No directory listing
- No eval/templating
- Cache-Control headers
