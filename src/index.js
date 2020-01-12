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
      const rowOK = await addDateToRow(row)
      console.warn(row)
      console.log(`  OK: ${row.expirationDate}`)
      rowsOK.push(rowOK)
      await later(delayInMs) // always wait before trying whois requests
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

const getClass = (days, recent) => {
  return days < 366 ? 'soon' : recent < 7 ? 'recent' : 'ok'
}

const getDates = async domain => {
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
      const updatedMatch = data.match(
        /(Updated Date: )(.*)(\n)/
      )

      return {updated: updatedMatch && updatedMatch[2], expiration: dateMatch[2]}
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
  const {updated, expiration} = await getDates(row.domain)
  row.expirationDate = expiration
  row.updatedDate = updated

  row.daysLeft = Math.floor(
    (new Date(row.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24)
  )
  row.updatedDays = Math.floor(
    -(new Date(row.updatedDate) - Date.now()) / (1000 * 60 * 60 * 24)
  )
  row.class = getClass(row.daysLeft, row.updatedDays)

console.warn(row)

  return row
}

const writeHtml = (html, filename) => {
  fs
    .writeFile(filename, html)
    .then(() => console.log(`The file ${filename} has been saved!`))
    .catch(console.log)
}

const run = async (domains) => {
  if (!domains)
    domains = await fs
    .readFile('src/domains.json', 'utf8')
    .then(JSON.parse)
    .then(addDate);

  const recent = domains.filter(d => d.recent < 10007).sort((a, b) => a.recent - b.recent);


  const template = await fs.readFile('src/index.mustache', 'utf8')
  const html = Mustache.render(template, {
    domains: domains.filter(d => d.class === "soon").sort((a, b) => a.daysLeft - b.daysLeft),
    recent,
    hasRecent: recent.length > 0,
    date: new Date(Date.now()).toISOString()
  })
  writeHtml(html, 'public/index.html')
}


const test = [
  { name: 'veill.es', daysLeft: 265, class: "soon" },
  { name: 'spip.org', daysLeft: 79, class: "soon" },
  { name: 'spip.com', daysLeft: 152, class: "soon" },
  { name: 'menteur.com', daysLeft: 67, class: "soon" },
  { name: 'rezo.net', daysLeft: 660, recent: 3, class: "recent" },
  { name: 'seenthis.net', daysLeft: 2007, recent: 456, class: "ok" },
  { name: 'framasoft.net', daysLeft: 313, recent: 3, class: "recent" },
  { name: 'laquadrature.net', daysLeft: 76, class: "soon" }
]

// run(test)
run()

