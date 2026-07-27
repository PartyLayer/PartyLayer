# Portable image for the DevNet gateway. Self-contained: installs its own deps from
# npm, so it runs next to the validator without the monorepo. @partylayer/react is a
# workspace dependency inside the monorepo (workspace:^); the image rewrites it to the
# published version so npm can resolve it. Its react peer is pulled in but unused at
# runtime; only the pure token-matching helpers from the /query subpath are called.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm pkg set dependencies.@partylayer/react="^2.3.0"
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json ./
RUN npm pkg set dependencies.@partylayer/react="^2.3.0"
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY scripts ./scripts
EXPOSE 8787
CMD ["node", "dist/index.js"]
