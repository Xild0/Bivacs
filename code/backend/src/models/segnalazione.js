/**
 * @file segnalazione.js
 * @description Modello Mongoose per le segnalazioni inviate dagli utenti registrati.
 * Ogni segnalazione riguarda un bivacco, include descrizione, foto e stato di avanzamento.
 */

const mongoose = require('mongoose');

const segnalazioneSchema = new mongoose.Schema({
    utenteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utente', 
        required: true
    },
    bivaccoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco',
        required: true
    },
    descrizione: { 
        type: String,
        required: [true, 'La descrizione della segnalazione è obbligatoria'], 
        trim: true, 
        minlength: [20, 'Sii più specifico: la descrizione deve avere almeno 20 caratteri']
    },
    foto: {
        type: String, // Qui andrà l'URL o il path del file
        required: [true, 'La foto della segnalazione è obbligatoria']
    },
    

    statoSegnalazione: {
        type: String,
        required: true,
        enum: ['inviata', 'presa_in_carico', 'in_corso', 'risolta', 'archiviata'],
        default: 'inviata'
    }
}, 
{
    timestamps: true
});

module.exports = mongoose.model('Segnalazione', segnalazioneSchema);