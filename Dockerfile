FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js storage.js deploy-commands.js ./

# /data is where channels.json lives — mount a volume here so it survives restarts.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV DATA_DIR=/data

CMD ["node", "index.js"]
