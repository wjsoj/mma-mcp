# Dockerfile for Mathematica MCP Server
# This MCP server executes Wolfram Language code via WolframScript
#
# NOTE: WolframScript must be accessible from the container.
# Use host network mode or mount the WolframScript executable.
# See DOCKER.md for details.

# Use the official Bun image (via DaoCloud mirror for China)
FROM m.daocloud.io/docker.io/oven/bun:1 AS base
WORKDIR /usr/src/app

# Install system dependencies (for health check)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies into temp directory
# This caches them and speeds up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy node_modules from temp directory
# Then copy all project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Run tests
ENV NODE_ENV=production
RUN bun test

# Copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app .

# Create non-root user for running the app
RUN useradd -m -u 1001 mcpuser && \
    chown -R mcpuser:mcpuser /usr/src/app
USER mcpuser

# Create directory for mounting WolframScript (if using volume mount)
RUN mkdir -p /host

# Environment variables for Docker
ENV MCP_TRANSPORT=http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3000 \
    NODE_ENV=production

# Expose the HTTP port
EXPOSE 3000/tcp

# Health check (only works when server is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run the app
ENTRYPOINT ["bun", "run", "index.ts"]
