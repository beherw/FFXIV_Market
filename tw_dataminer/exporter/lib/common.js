const fs = require('fs')
const readCsv = require('./read-csv')

let config

const init = function (_config) {
  config = _config
}

const i18n = function (dbName, id, nKey = 'name') {
  let hasValidName = false
  const name = config.languages.reduce((obj, { output, file }) => {
    const dbInst = db(dbName, file, true)
    const dbRow = typeof id === 'function' ? dbInst.find(id) : dbInst.findById(id)
    if (dbRow && dbRow[nKey]) {
      hasValidName = true
      obj[output] = dbRow[nKey]
    }

    return obj
  }, {})

  return hasValidName ? name : undefined
}

Array.prototype.binarySearch = function (id) {
  id = +id
  if (isNaN(id)) return -2

  if (this.length === 0) return -1

  if (this.length > id && this[id] && id === +this[id]['#']) {
    return id
  }

  let startPos = 0
  let endPos = this.length - 1

  while (startPos <= endPos) {
    const pos = startPos + Math.floor((endPos - startPos) / 2)
    const posId = this[pos] && +this[pos]['#']

    // Sparse or malformed input is not safe to binary-search. Let findById
    // use its guarded linear fallback instead.
    if (!Number.isFinite(posId)) return -2

    if (posId === id) {
      return pos
    } else if (posId > id) {
      endPos = pos - 1
    } else {
      startPos = pos + 1
    }
  }

  return -1
}

Array.prototype.findById = function (id) {
  let index = this.binarySearch(id)
  if (index === -1) return null

  if (index < 0) {
    return this.find(item => item && typeof item === 'object' && +item['#'] === +id) || null
  } else {
    return this[index]
  }
}

Array.prototype.kvmap = function (nKey = 'Name', valueFunc = (val) => val) {
  return this.map(item => ({ key: item['#'], value: valueFunc(item[nKey]) }))
}

Array.prototype.toObject = function (valueFunc = (val) => val, idKey = '#') {
  return this.reduce((obj, row) => {
    obj[row[idKey]] = valueFunc(row)
    return obj
  }, {})
}

Array.prototype.simpleObject = function (key) {
  if (!this._meta) {
    throw new Error('Method called on non-db-rows array')
  }

  return this.toObject(row => row[key] ? i18n(this._meta.name, row['#'], key) : undefined)
}

const dbStore = {}

const db = function (name, lang = null, cache = false) {
  if (!lang && lang !== false) {
    lang = config.languages[0].file
  }

  let file = lang ? `${name}.${lang}` : name
  if (dbStore[file]) {
    return dbStore[file]
  }

  const filePath = config.dbPath(file)
  if (!fs.existsSync(filePath)) {
    const empty = []
    empty._meta = { name, lang, file }
    if (cache) dbStore[file] = empty
    return empty
  }

  const dbItem = readCsv(fs.readFileSync(filePath, 'utf-8'))
  dbItem._meta = { name, lang, file }

  if (cache) {
    dbStore[file] = dbItem
  }

  return dbItem
}

const outputList = process.argv[2] ? process.argv[2].split(',') : null

const output = function (name, content) {
  if (outputList && !outputList.includes(name)) return

  console.log('output', name)
  if (typeof content === 'function') {
    content = content()
  }

  const outPath = config.outputPath(name)
  const dir = require('path').dirname(outPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(outPath, JSON.stringify(content, null, 2) + '\n')
}

const translate = function (dbName, value, from, nKey = 'Name') {
  const query = value.toLowerCase()
  const row = db(dbName, from, true).find(item => item[nKey].toLowerCase() === query)

  return row ? i18n(dbName, row['#'], nKey) : null
}

module.exports = { init, db, output, translate, i18n }
