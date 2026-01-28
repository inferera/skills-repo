# Docker Image Optimizer

Dramatically reduce Docker image sizes while improving security and build performance.

## Key Benefits

- 🎯 **Reduce image size by 50-80%**
- 🔒 **Improve security with minimal base images**
- ⚡ **Faster builds and deployments**
- 📦 **Multi-stage build optimization**
- 🛡️ **Vulnerability scanning integration**

## Features

### Size Optimization
- Multi-stage builds
- Minimal base images (Alpine, Distroless)
- Layer caching strategies
- .dockerignore best practices

### Security Hardening
- Non-root user execution
- Minimal attack surface
- Security scanning integration
- Secret management

### Build Performance
- Parallel build stages
- BuildKit optimizations
- Cache mount usage
- Dependency caching

## Quick Start

```bash
# Analyze your current Dockerfile
docker-optimizer analyze Dockerfile

# Get optimization recommendations
docker-optimizer recommend

# Apply optimizations
docker-optimizer optimize Dockerfile > Dockerfile.optimized
```

## Examples

### Before Optimization

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]
```

**Result**: 1.2 GB image

### After Optimization

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Result**: 180 MB image (85% reduction!)

## Optimization Strategies

### 1. Multi-Stage Builds

Separate build and runtime dependencies:

```dockerfile
# Build stage - includes dev tools
FROM node:18 AS builder
RUN npm install && npm run build

# Runtime stage - only production dependencies
FROM node:18-alpine
COPY --from=builder /app/dist ./dist
```

### 2. Minimal Base Images

| Base Image | Size | Use Case |
|------------|------|----------|
| `node:18` | 1 GB | Development |
| `node:18-alpine` | 180 MB | Production |
| `node:18-slim` | 250 MB | When Alpine is too minimal |
| `gcr.io/distroless/nodejs18` | 120 MB | Maximum security |

### 3. Layer Optimization

```dockerfile
# ❌ Bad: Invalidates cache on any file change
COPY . .
RUN npm install

# ✅ Good: Cache dependencies separately
COPY package*.json ./
RUN npm ci --only=production
COPY . .
```

### 4. .dockerignore

```
node_modules
npm-debug.log
.git
.env
*.md
tests
```

## Advanced Techniques

### BuildKit Features

```dockerfile
# syntax=docker/dockerfile:1.4

# Cache mount for package managers
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Secret mount (never cached)
RUN --mount=type=secret,id=npm_token \
    echo "//registry.npmjs.org/:_authToken=$(cat /run/secrets/npm_token)" > .npmrc && \
    npm install && \
    rm .npmrc
```

### Parallel Stages

```dockerfile
FROM base AS deps
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
RUN npm test

FROM base AS production
COPY --from=build /app/dist ./dist
```

## Security Best Practices

### 1. Non-Root User

```dockerfile
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001
USER appuser
```

### 2. Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js
```

### 3. Minimal Permissions

```dockerfile
COPY --chown=appuser:appuser --chmod=755 ./app /app
```

## Benchmarks

| Project Type | Before | After | Reduction |
|--------------|--------|-------|-----------|
| Node.js API | 1.2 GB | 180 MB | 85% |
| Python Flask | 950 MB | 150 MB | 84% |
| Go Binary | 850 MB | 12 MB | 98.6% |
| Java Spring | 670 MB | 220 MB | 67% |

## Integration

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Optimize Docker image
  run: |
    docker-optimizer analyze Dockerfile
    docker build -t myapp:optimized -f Dockerfile.optimized .
    docker image ls myapp:optimized
```

### Security Scanning

```bash
# Scan optimized image
trivy image myapp:optimized

# Grype scan
grype myapp:optimized
```

## Configuration

Create `.docker-optimizer.yml`:

```yaml
baseImage: node:18-alpine
multiStage: true
securityHardening: true
minimalLayers: true
cacheOptimization: true
```

## Requirements

- Docker 20.10+
- BuildKit enabled
- Basic Dockerfile knowledge

## Common Issues

### Alpine Compatibility
Some packages may not work on Alpine. Use `node:18-slim` as fallback.

### Build Time
Multi-stage builds may take longer initially but are faster for rebuilds.

## Tips

- Always use specific version tags (not `latest`)
- Combine RUN commands to reduce layers
- Order instructions from least to most frequently changing
- Use `.dockerignore` aggressively
- Test optimized images thoroughly

## Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [BuildKit Documentation](https://docs.docker.com/build/buildkit/)
- [Distroless Images](https://github.com/GoogleContainerTools/distroless)

## License

MIT - See LICENSE file for details.
