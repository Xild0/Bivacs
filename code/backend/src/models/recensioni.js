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
        required: [true,'La valutazione è obbligatoria'],
        min: [1, 'Rating non valido'], 
        max: [5, 'Rating non valido']
    },
    testo: {
        type: String,
        required: [true, 'Il testo della recensione è obbligatorio'] 
    }
}, { timestamps: true });

// Questo risolve l'errore "implicitly has type any"
/**
 * @param {any} bivaccoId 
 */
/**
 * @this {import('mongoose').Model<any>}
 * @param {any} bivaccoId
 */
recensioneSchema.statics.calcolaMedia = async function(bivaccoId) {
    const stats = await this.aggregate([
        { $match: { bivaccoId: bivaccoId } },
        {
            $group: {
                _id: '$bivaccoId',
                nRecensioni: { $sum: 1 },
                mediaVoti: { $avg: '$stelle' }
            }
        }
    ]);

    if (stats.length > 0) {
        await mongoose.model('Bivacco').findByIdAndUpdate(bivaccoId, {
            numRecensioni: stats[0].nRecensioni,
            mediaStelle: Math.round(stats[0].mediaVoti * 10) / 10
        });
    }
};

// 3. MIDDLEWARE
recensioneSchema.post('save', function() {
    // Usiamo il riferimento al modello per evitare problemi di inizializzazione circolare
    this.constructor.calcolaMedia(this.bivaccoId);
});
module.exports = mongoose.model('Recensione', recensioneSchema);