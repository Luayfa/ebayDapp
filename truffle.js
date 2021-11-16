// Allows us to use ES6 in our migrations and tests.
require('babel-register')

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 4704624
    },
    ropsten: {
      host: 'localhost',
      port: 8545,
      network_id: '3',
      gas: 4700000
    }
  }
}
