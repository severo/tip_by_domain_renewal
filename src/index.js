const whois = require('whois-api')
const fs = require('fs').promises
const Mustache = require('mustache')

const addDate = async rows => {
  const rowsOK = []
  for (const row of rows) {
    const rowOK = await addDateToRow(row)
    rowsOK.push(rowOK)
  }
  return rowsOK
}

const getClass = days => {
  return days < 0 ? 'past' : days < 90 ? 'soon' : 'ok'
}

const lookup = async domain => {
  return new Promise((resolve, reject) => {
    // to be promisified
    whois.lookup(domain, function (err, data) {
      if (err) {
        reject(err)
      }
      if (data.registrar !== 'Gandi SAS') {
        reject(new RangeError('For now, the only supported registrar is Gandi'))
      }
      resolve(data.expiration_date)
    })
  })
}

const addDateToRow = async row => {
  row.expirationDate = await lookup(row.domain)
  row.daysLeft = Math.floor(
    (new Date(row.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24)
  )
  row.class = getClass(row.daysLeft)
  return row
}

const writeHtml = async (html, dir, filename) => {
  await fs.mkdir(dir, { recursive: true }, (err) => {
    if (err) throw err
  })
  await fs.writeFile(dir + '/' + filename, html)
    .then(() => console.log('The file was saved!'))
    .catch(console.log)
}

const run = async () => {
  const text = await fs.readFile('src/domains.json', 'utf8')
  const domains = JSON.parse(text)
  const domainsOK = await addDate(domains)
  const template = await fs.readFile('src/index.mustache', 'utf8')
  const html = Mustache.render(template, {
    domains: domainsOK.sort((a, b) => a.daysLeft > b.daysLeft)
  })
  await writeHtml(html, 'public', 'index.html')
}

run()
