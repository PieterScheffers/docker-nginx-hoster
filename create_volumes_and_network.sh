#!/usr/bin/env bash

# create volumes

if ! docker volume ls -q | grep -l '^certs\-volume$' > /dev/null ; then
	echo 'Creating certs-volume'
	docker volume create certs-volume > /dev/null
else
	echo 'certs-volume already exists'
fi

if ! docker volume ls -q | grep -l '^webroot\-volume$' > /dev/null ; then
	echo 'Creating webroot-volume'
	docker volume create webroot-volume > /dev/null
else
	echo 'webroot-volume already exists'
fi

if ! docker volume ls -q | grep -l '^conf\-volume$' > /dev/null ; then
	echo 'Creating conf-volume'
	docker volume create conf-volume > /dev/null
else
	echo 'conf-volume already exists'
fi


# create network

if ! docker network ls | grep -l 'main\-network' > /dev/null ; then
	echo 'Creating main-network'
	docker network create main-network > /dev/null
else
	echo 'main-network already exists'
fi

exit
