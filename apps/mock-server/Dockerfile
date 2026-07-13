FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY db.json ./

ENV HOST=0.0.0.0
ENV PORT=4000

EXPOSE 4000

# Bind on 0.0.0.0 so the published port is reachable from the host.
CMD ["npx", "json-server", "--host", "0.0.0.0", "--port", "4000", "db.json"]
