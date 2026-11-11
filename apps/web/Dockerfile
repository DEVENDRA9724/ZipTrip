# ==============================================================================
# Production Dockerfile for Safar Self Drive Web Portal
# High-Performance Alpine Nginx with Gzip Compression and Security Headers
# ==============================================================================
FROM nginx:1.27-alpine

LABEL maintainer="Safar DevOps Team <devops@safarselfdrive.com>"

# Install curl for reliable container health checking
RUN apk add --no-cache curl

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom hardened virtual host configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend static portal assets
COPY apps/web/ /usr/share/nginx/html/

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
