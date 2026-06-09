/**
 * @file utenteRegistrato.js
 * @description Modello Mongoose per l'utente registrato standard.
 * Estende il modello Utente e aggiunge dati anagrafici e lista dei bivacchi preferiti.
 */

const mongoose = require('mongoose');

const Utente = require('./utente');

/**
 * Schema dei dati aggiuntivi associati a un utente registrato.
 *
 * @type {mongoose.Schema}
 */

const utenteRegistratoSchema = new mongoose.Schema(
{
    nome: {
        type: String,
        required: [true, 'Il nome dell\'utente registrato è obbligatorio']
    },
    cognome: {
        type: String,
        required: [true, 'Il cognome dell\'utente registrato è obbligatorio']
    },
    dataNascita: {
        type: Date,
        required: [true, 'La data di nascita è obbligatoria']
    },
    preferiti: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco'
    }]
},
{
    timestamps: true
});

// UtenteRegistrato estende il modello base Utente tramite discriminator.
module.exports = Utente.discriminator('UtenteRegistrato', utenteRegistratoSchema);
