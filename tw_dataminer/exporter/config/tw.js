const path = require('path')

// Paths: library and output live in tw_dataminer/ (production)
module.exports = {
  dbPath: (name) => path.join(
    __dirname,
    '../../library/',
    `${name}.csv`
  ),
  outputPath: (name) => path.join(
    __dirname,
    '../../output/',
    `tw-${name}.json`
  ),
  languages: [{
    output: 'tw',
    file: ''
  }]
}
