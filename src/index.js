// const whois = require('whois-api')
// const dsv = require('d3-dsv')
const fs = require('fs').promises
const Mustache = require('mustache')

const parseCsv = text => {
  const rows = [{
    domain: 'rezo.net',
    name: 'Rezo',
    description: 'Le réseau des copains',
    url: 'https://rezo.net'
  }, {
    domain: 'visionscarto.net',
    name: 'Visionscarto',
    description: 'Réseau indépendant de recherche sur les cartes et les représentations',
    url: 'https://visionscarto.net'
  }]
  return rows
}

const addDate = async rows => {
  const rowsOK = []
  for (const row of rows) {
    const rowOK = await addDateToRow(row)
    rowsOK.push(rowOK)
  }
  return rowsOK
}

const getClass = days => {
  return (days < 0)
    ? 'past' : (days < 10)
      ? 'urgent' : (days < 30)
        ? 'soon' : 'ok'
}

const addDateToRow = async row => {
  // to be promisified
  // whois.lookup(row.domain, function (err, data) {
  //   if (err) {
  //     data.expiration_date = '2020-03-07T05:00:00Z'
  //   }
  //   // 2023-05-20T14:01:45Z
  //   row.expiration_date = data.expiration_date || '2020-03-07T05:00:00Z'
  // })
  if (row.domain === 'rezo.net') {
    row.expirationDate = '2020-03-07T05:00:00Z'
  } else {
    row.expirationDate = '2023-05-20T14:01:45Z'
  }
  row.daysLeft = Math.floor((new Date(row.expirationDate) - Date.now()) / (1000 * 60 * 60 * 24))
  row.class = getClass(row.daysLeft)
  return row
}

const writeHtml = (html, filename) => {
  fs.writeFile(filename, html).then(() => console.log('The file was saved!')).catch(console.log)
}

const run = async () => {
  const text = await fs.readFile('src/domains.csv', 'utf8')
  const rows = await parseCsv(text)
  // const rows = dsv.parse(text)
  const rowsOK = await addDate(rows)
  const template = await fs.readFile('src/index.mustache', 'utf8')
  const html = Mustache.render(template, { domains: rowsOK.sort((a, b) => a.daysLeft > b.daysLeft) })
  writeHtml(html, 'public/index.html')
}

run()
