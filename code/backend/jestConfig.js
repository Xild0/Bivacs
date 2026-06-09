/**
 * @file jest.config.js
 * @description Configurazione Jest per i test di integrazione del backend Bivacs.
 */

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/routes/**/*.js',
    'src/utils/**/*.js',
    'src/middlewares/**/*.js'
  ]
};
