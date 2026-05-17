/**
 * @file recensione.js
 * @description Modello Mongoose per le recensioni dei bivacchi.
 * Ogni recensione contiene valutazione a stelle, testo, autore visualizzato e opzione anonima.
 */

const mongoose = require('mongoose');

const recensioneSchema = new mongoose.Schema({
  bivaccoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bivacco',
    required: true
  },
  utente: {
    type: String,
    default: 'Anonimo'
  },
  stelle: {
    type: Number,
    required: [true, 'La valutazione è obbligatoria'],
    min: [1, 'Rating non valido'],
    max: [5, 'Rating non valido']
  },
  testo: {
    type: String,
    required: [true, 'Il testo della recensione è obbligatorio']
  },
  anonima: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });


/**
 * Calcola il numero totale di recensioni e la media delle stelle per un bivacco.
 * Aggiorna direttamente il documento Bivacco con i campi `numRecensioni` e `mediaStelle`.
 *
 * @param {mongoose.Types.ObjectId|string} bivaccoId - ObjectId del bivacco recensito.
 * @returns {Promise<void>}
 */

recensioneSchema.statics.calcolaMedia = async function(bivaccoId) {
  const self = /** @type {import('mongoose').Model<any>} */ (/** @type {unknown} */ (this));
  const stats = /** @type {Array<{ _id: mongoose.Types.ObjectId, nRecensioni: number, mediaVoti: number }> }*/ (await self.aggregate([
    { $match: { bivaccoId: new mongoose.Types.ObjectId(bivaccoId) } },
    {
      $group: {
        _id: '$bivaccoId',
        nRecensioni: { $sum: 1 },
        mediaVoti: { $avg: '$stelle' }
      }
    }
  ]));

  if (stats.length > 0) {
    await mongoose.model('Bivacco').findByIdAndUpdate(bivaccoId, {
      numRecensioni: stats[0].nRecensioni,
      mediaStelle: Math.round(stats[0].mediaVoti * 10) / 10
    });
  }
};

recensioneSchema.post('save', async function() {
  const constructorWithMethod = /** @type {unknown} */ (this.constructor);
  await /** @type {{ calcolaMedia: (bivaccoId: mongoose.Types.ObjectId|string) => Promise<void> }} */ (constructorWithMethod).calcolaMedia(this.bivaccoId);
});

module.exports = mongoose.model('Recensione', recensioneSchema);