const whois = require('whois')
const retry = require('async-retry')
const fs = require('fs').promises
const Mustache = require('mustache')

const delayInS = 60
const delayInMs = delayInS * 1000
const later = delay => new Promise(resolve => setTimeout(resolve, delay))

const addDate = async rows => {
  const rowsOK = []
  for (const row of rows) {
    try {
      console.log(
        `Fetching expiration date from whois request, for domain ${row.domain} (in ${delayInS}s)`
      )
      await later(delayInMs) // always wait before trying whois requests
      const rowOK = await addDateToRow(row)
      console.log(`  OK: ${row.expirationDate}`)
      rowsOK.push(rowOK)
    } catch (e) {
      // Just log the error in case there is one (for example if the domain is
      // not from Gandi registrar), don't add the row, and don't throw any
      // exception
      console.log('  ERROR: expiration date could not be fetched')
      console.error(e)
    }
  }
  return rowsOK
}

const getClass = days => {
  return days < 366 ? 'soon' : 'ok'
}

const getExpirationDate = async domain => {
  return retry(
    async (bail, attemptId) => {
      // if anything throws, retry

      if (attemptId > 1) {
        console.log(`  Retry #${attemptId - 1}`)
      }

      const data = await asyncLookup(domain)

      if (
        data.indexOf('Your IP has been restricted due to excessive access') !==
        -1
      ) {
        throw new RangeError("Gandi's rate limit has been exceeded.")
      }

      // Find the registrar
      const registrarMatch = data.match(/Registrar: (.*)\n/)

      if (!registrarMatch || registrarMatch.length !== 2) {
        // don't retry if we got a validation error
        bail(
          new RangeError(
            `WHOIS answer is not conform to GANDI whois format: ${data}.`
          )
        )
        return
      } else if (registrarMatch[1] !== 'GANDI SAS') {
        // don't retry if we got a validation error
        bail(
          new RangeError(
            `${domain} is registered with ${
              registrarMatch[1]
            }. For now, the only supported registrar is Gandi SAS.`
          )
        )
        return
      }

      // Find the expiration date
      const dateMatch = data.match(
        /(Registrar Registration Expiration Date: |Registry Expiry Date: )(.*)(\n)/
      )
      if (!dateMatch || dateMatch.length !== 4) {
        bail(
          new RangeError(
            `Cannot parse the expiration date from Gandi WHOIS reponse:\n\n${data}\n\n`
          )
        )
        return
      }

      return dateMatch[2]
    },
    {
      retries: 3,
      minTimeout: 2 * delayInMs
    }
  )
}

const asyncLookup = async domain => {
  return new Promise((resolve, reject) => {
    whois.lookup(
      domain,
      {
        server: 'whois.gandi.net'
      },
      function (err, data) {
        if (err) {
          // For example, Gandi may cut the TCP connection with the following error:
          // # Your IP has been restricted due to excessive access, please wait a bit
          reject(err)
        }
        resolve(data)
      }
    )
  })
}

const addDateToRow = async row => {
  row.expirationDate = await getExpirationDate(row.domain)

  row.daysLeft = Math.floor(
    (new Date(row.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24)
  )
  row.class = getClass(row.daysLeft)
  return row
}

const writeHtml = (html, filename) => {
  fs
    .writeFile(filename, html)
    .then(() => console.log(`The file ${filename} has been saved!`))
    .catch(console.log)
}

const run = async () => {
  const text = await fs.readFile('src/domains.json', 'utf8')
  const domains = JSON.parse(text)
  const domainsOK = await addDate(domains)
  // const domainsOK = []
  // const domainsOK = [
  //   { name: 'veill.es', daysLeft: 265 },
  //   { name: 'spip.org', daysLeft: 79 },
  //   { name: 'spip.com', daysLeft: 152 },
  //   { name: 'menteur.com', daysLeft: 67 },
  //   { name: 'rezo.net', daysLeft: 66 },
  //   { name: 'seenthis.net', daysLeft: 207 },
  //   { name: 'framasoft.net', daysLeft: 313 },
  //   { name: 'laquadrature.net', daysLeft: 76 }
  // ]
  const template = await fs.readFile('src/index.mustache', 'utf8')
  const html = Mustache.render(template, {
    domains: domainsOK.sort((a, b) => a.daysLeft - b.daysLeft),
    date: new Date(Date.now()).toISOString()
  })
  writeHtml(html, 'public/index.html')
}

run()
