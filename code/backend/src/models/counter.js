/**
 * @file counter.js
 * @description Modello Mongoose per la gestione degli identificativi numerici progressivi.
 *
 * Viene utilizzato dalle utility di sequenza per generare id applicativi
 * incrementali per utenti, bivacchi, ticket, alert e altri documenti.
 */
const mongoose = require('mongoose');

/**
 * Schema utilizzato per la generazione incrementale
 * degli identificativi numerici applicativi.
 *
 * @type {mongoose.Schema}
 */

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);