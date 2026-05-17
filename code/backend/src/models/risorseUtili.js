/**
 * @file risorseUtili.js
 * @description Modello Mongoose per le informazioni aggiornate dagli utenti sulle risorse utili.
 * Permette di registrare lo stato di acqua e legna per uno specifico bivacco.
 */

const mongoose = require('mongoose');

const risorseUtiliSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID delle risorse è obbligatorio']
    },
    bivacco: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco',
        required: [true, 'Il riferimento al bivacco è obbligatorio']
    },
    autore: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utente'
    },
    acqua: {
        type: String,
        required: [true, 'Le info sull\'acqua sono obbligatorie'],
        enum: ['disponibile', 'scarsa', 'assente', 'non_verificata']
    },
    legna: {
        type: String,
        required: [true, 'Le info sulla legna sono obbligatorie'],
        enum: ['disponibile', 'scarsa', 'assente', 'non_verificata']
    }
}, { timestamps: true });

module.exports = mongoose.model('RisorseUtili', risorseUtiliSchema);