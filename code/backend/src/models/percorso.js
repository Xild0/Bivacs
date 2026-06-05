/**
 * @file percorso.js
 * @description Modello Mongoose per i percorsi GPX associati ai bivacchi.
 * Memorizza il file GPX, i dati altimetrici, la difficoltà CAI,
 * la lunghezza stimata e il riferimento al bivacco.
 */

const mongoose = require('mongoose');

const percorsoSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: [true, "L'ID del percorso è obbligatorio"]
    },
    bivacco: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bivacco',
      required: [true, 'Il riferimento al bivacco è obbligatorio']
    },
    gpxFile: {
      type: String,
      required: [true, 'Il file GPX del percorso è obbligatorio']
    },
    dislivello: {
      type: Number,
      default: 0
    },
    difficolta: {
      type: String,
      enum: ['T', 'E', 'EE', 'EEA'],
      default: 'E'
    },
    lunghezza: {
      type: Number,
      default: 0
    },
    durataStimata: {
      type: Number,
      default: 0
    },
    tipo: {
      type: String,
      enum: ['ottimale', 'panoramico', 'sat', 'fallback'],
      default: 'sat'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Percorso', percorsoSchema);