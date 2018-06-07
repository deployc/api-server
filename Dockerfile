FROM node:10.2.1-alpine as builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk --update --no-cache add --virtual .build-deps \
        python \
        make \
        musl-dev \
        gcc \
        g++ && \
    npm install && \
    apk del .build-deps

COPY index.js .
COPY routes ./routes
COPY middleware ./middleware
COPY definitions ./definitions
COPY utils ./utils

CMD [ "npm", "start" ]
