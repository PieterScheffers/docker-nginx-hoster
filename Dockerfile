FROM node:alpine

# Install docker 17.05.0
# Install certbot-auto 17-05-2017
# TODO: download latest from github
COPY ./bin/* /usr/bin/

RUN mkdir -p /usr/app \
	&& mkdir -p /etc/nginx/conf.d \
	&& mkdir -p /etc/nginx/certs \
	&& chmod +x /usr/bin/docker

COPY ./src /usr/app

WORKDIR /usr/app
RUN [ "npm", "install" ]

ENV PATH /usr/app/node_modules/.bin:$PATH

CMD node index.js
