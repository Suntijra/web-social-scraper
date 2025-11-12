FROM --platform=linux/amd64 mcr.microsoft.com/playwright:v1.56.1-jammy AS base

ENV DEBIAN_FRONTEND=noninteractive \
    BUN_INSTALL=/root/.bun \
    PATH=/root/.bun/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash \
  && bun --version

WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile
RUN npx playwright install chrome

# Copy the rest of the workspace (TypeScript sources, config, etc.)
COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    PLAYWRIGHT_HEADLESS=1 \
    PLAYWRIGHT_BROWSER=chromium

# Build the bundled server output
RUN bun run build

EXPOSE 8000

CMD ["bun", "dist/server.js"]
