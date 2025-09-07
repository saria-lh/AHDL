# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
ENV PORT=3001
WORKDIR /app
COPY --from=builder /app ./
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001 || exit 1

EXPOSE 3001
CMD ["npm", "run", "start", "--", "--port", "3001"]

# docker build -t drone-frontend .
# docker run -p 3001:3001 drone-frontend