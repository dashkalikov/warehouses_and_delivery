FROM node:24-alpine

WORKDIR /opt/kontur
ENV KONTUR_HOST=0.0.0.0 PORT=4173

COPY server.mjs ./
COPY app/ ./app/

USER node
EXPOSE 4173
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "server.mjs"]
