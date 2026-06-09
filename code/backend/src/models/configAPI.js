/**
 * @file configAPI.js
 * @description Modello Mongoose per configurare i provider API esterni.
 *
 * Include:
 * - nome del provider;
 * - URL base configurabile;
 * - stato di abilitazione;
 * - timeout di chiamata.
 */

const mongoose = require('mongoose');

/**
 * Schema di configurazione dei provider API esterni.
 *
 * @type {mongoose.Schema}
 */

const configAPISchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  provider: {
    type: String,
    required: true,
    unique: true
  },
  baseUrl: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  timeoutMs: {
    type: Number,
    default: 5000
  }
}, { timestamps: true });

module.exports = mongoose.model('ConfigAPI', configAPISchema);