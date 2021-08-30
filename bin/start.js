require('babel-register') ({
    presets: [ 'env', 'stage-0' ]
})

module.exports = require('../bin/www')