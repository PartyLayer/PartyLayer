# Portable image for the DevNet gateway. Self-contained: installs its own deps from
# npm (no workspace linking), so it runs next to the validator without the monorepo.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY scripts ./scripts
EXPOSE 8787
CMD ["node", "dist/index.js"]
