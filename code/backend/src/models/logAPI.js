/**
 * @file logAPI.js
 * @description Modello Mongoose per il tracciamento delle chiamate verso API esterne.
 * Registra provider, esito della chiamata ed eventuali dettagli di errore.
 */

const mongoose = require('mongoose');

/**
 * Schema per il tracciamento delle invocazioni verso API esterne.
 *
 * @type {mongoose.Schema}
 */

const logAPISchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID della chiamata API è obbligatorio']
    },
    provider: {
        type: String,
        required: [true, 'Il provider della chiamata API è obbligatorio']
    },
    esito: {
        type: Boolean,
        required: [true, 'L\'esito della chiamata API è obbligatorio']
    },
    dettaglioErrore: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('LogAPI', logAPISchema);