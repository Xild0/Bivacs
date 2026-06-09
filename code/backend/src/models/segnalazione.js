/**
 * @file segnalazione.js
 * @description Modello Mongoose per le segnalazioni inviate dagli utenti registrati.
 * Ogni segnalazione riguarda un bivacco, include descrizione, immagini collegate
 * e stato di avanzamento.
 */

const mongoose = require('mongoose');

/**
 * Schema che rappresenta una segnalazione inviata da un utente.
 *
 * @type {mongoose.Schema}
 */

const segnalazioneSchema = new mongoose.Schema(
  {
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

    immagini: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Immagine'
      }
    ],

    /**
     * Campo mantenuto per retrocompatibilità con il frontend e con eventuali
     * segnalazioni già presenti nel database.
     * La relazione principale corretta è `immagini`.
     */
    foto: {
      type: String,
      default: ''
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
  }
);

module.exports = mongoose.model('Segnalazione', segnalazioneSchema);