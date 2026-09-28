# ==========================================
# Newsletter Builder Frontend Dockerfile
# Multi-stage: Node.js build -> Nginx serving
# ==========================================

# -----------------
# Stage 1: Build
# -----------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Copy full frontend source code
COPY . .

# Optional build argument for API URL if needed
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the production Vite bundle (outputs to /app/dist)
RUN npm run build

# -----------------
# Stage 2: Production Nginx Server
# -----------------
FROM nginx:alpine

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy built production assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard HTTP port
EXPOSE 80

# Start Nginx server in foreground
CMD ["nginx", "-g", "daemon off;"]
