# TODO

- Schedule 'certbot renew'

# Issues

### Nginx doesn't resolve an address when the dns lease expires
Can be resolved in 2 ways:
1. Use a nginx 'hack' to let nginx resolve the name every request.
[nginx with dynamic upstreams](https://tenzer.dk/nginx-with-dynamic-upstreams/)
2. Use the IP's of the other containers, found in the inspection of a container. Can also check if the container is reachable (in one of the networks of the nginx proxy) and log a warning if it isn't.
