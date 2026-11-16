FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir data .runtime && chown node:node data .runtime
COPY server ./server
COPY shared ./shared
COPY client ./client
COPY tools/run.js tools/worlds.js tools/healthcheck.js tools/live-update.js ./tools/
COPY worlds/minimal/client ./worlds/minimal/client
COPY worlds/minimal/shared ./worlds/minimal/shared
COPY worlds/minimal/server ./worlds/minimal/server
COPY worlds/minimal/world.json worlds/minimal/LICENSE ./worlds/minimal/
COPY LICENSE THIRD_PARTY.md PROVENANCE.md ./
USER node
ENV PORT=3080 HOST=0.0.0.0 WORLD=minimal
EXPOSE 3080
VOLUME ["/app/data"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD ["node", "tools/healthcheck.js"]
CMD ["node", "tools/run.js"]
