FROM node:16

RUN apt update
RUN apt dist-upgrade -y

EXPOSE 3000
WORKDIR /app

COPY ./package.json /app
COPY ./yarn.lock /app
COPY ./public /app/public
COPY ./src /app/src

RUN yarn install
