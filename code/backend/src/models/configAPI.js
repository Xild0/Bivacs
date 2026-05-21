/**
 * @file configAPI.js
 * @description Modello per configurare provider API esterne.
 */

const mongoose = require('mongoose');

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