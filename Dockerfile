FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DMC_DATA_DIR=/app/data
COPY --chown=node:node package.json package-lock.json server.mjs game-engine.mjs chat.mjs lobby-chat.js sortable.js container-start.mjs index.html online.html ./
RUN mkdir -p /app/data && chown node:node /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "container-start.mjs"]
