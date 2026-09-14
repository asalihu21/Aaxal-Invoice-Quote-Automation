FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=4173 \
    AAXAL_DB_PATH=/app/data/aaxal.sqlite

WORKDIR /app

COPY --chown=node:node package.json server.js db.js ./
COPY --chown=node:node public ./public

RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 4173
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(response => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "--no-warnings", "server.js"]
