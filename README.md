# docker-nginx-hoster

Not usable yet!

### States

The generation of the dhparam, the self-signed certificates and the letsencrypt takes time. 
These are the states an application takes when the proxy is started. 
The self-signed certificate and the dhparam are generated directly when the proxy is started.

1. No dhparam or self-signed certificates have been generated. --> http
2. Self-signed certificates are generated, but dhparam not yet. --> http
3. self-signed certificates and dhparam are generated. --> https, self-signed
4. letsencrypt and dhparam are generated. --> https, letsencrypt
