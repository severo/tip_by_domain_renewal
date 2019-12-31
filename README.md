# README

First install:

```bash
git clone git@github.com:severo/tip_by_domain_renewal.git
cd tip_by_domain_renewal
npm install
```

Generate `public/index.html` (note that it takes at least 1 minute per domain,
in order to be kind with Gandi Whois server, so be prepared to wait):

```bash
npm run build
```

Serve `public/index.html`.
