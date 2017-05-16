FROM node

# Install docker 17.05.0
COPY ./bin/docker /usr/bin

RUN mkdir -p /usr/app

COPY ./src /usr/app

WORKDIR /usr/app
RUN [ "npm", "install" ]

ENV PATH /usr/app/node_modules/.bin:$PATH

CMD node index.js
