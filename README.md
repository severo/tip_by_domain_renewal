# README

This small software is used to generate the website https://rednegra.net/payetondomaine/.

## INSTALL

If you're interested in supporting another list of domains, feel free to do it with this software, it's licenced under GNU GPL3.

First install the dependencies:

```bash
git clone git@github.com:severo/tip_by_domain_renewal.git
cd tip_by_domain_renewal
npm install
```

Update the [domains lists](./src/domains.json):

```
vi src/domains.json
```

Generate `public/index.html` (note that it takes at least 1 minute per domain,
in order to be kind with Gandi Whois server, so be prepared to wait):

```bash
npm run build
```

Serve `public/index.html`.
