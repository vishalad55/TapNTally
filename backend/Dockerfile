# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN npm ci --workspace @tapntally/shared --workspace @tapntally/backend --no-audit --no-fund
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
RUN npm run build --workspace @tapntally/shared && npm run build --workspace @tapntally/backend

# ---- runtime stage ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json ./shared/
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
WORKDIR /app/backend
CMD ["node", "dist/main.js"]
