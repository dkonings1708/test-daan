FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DMC_DATA_DIR=/app/data
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=dmc-npm,target=/root/.npm npm ci --omit=dev --ignore-scripts --no-audit --no-fund --prefer-offline
COPY --chown=node:node password-visibility.js notifications.mjs notifications-ui.js sw.js manifest.webmanifest app-icon-192.png app-icon-512.png server.mjs header-menu.js social.mjs social-ui.js account-auth.mjs account-ui.js shake.js teams.mjs profiles.mjs supabase-profiles.mjs profile-ui.js game-engine.mjs chat.mjs lobby-chat.js sortable.js avatars.mjs avatar-store.mjs beer-mugs.js unsaved-changes.js container-start.mjs index.html online.html ./
RUN mkdir -p /app/data && chown node:node /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "container-start.mjs"]
