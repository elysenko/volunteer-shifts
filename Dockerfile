# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine

# Replace the default site with our unprivileged (port 8080) config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static content
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
