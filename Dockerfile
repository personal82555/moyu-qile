FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev --registry=https://registry.npmmirror.com
COPY server.js .
COPY app app
EXPOSE 7025
ENV PORT=7025
CMD ["node", "server.js"]
