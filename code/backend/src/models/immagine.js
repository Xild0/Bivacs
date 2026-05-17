/**
 * @file immagine.js
 * @description Modello Mongoose per le immagini collegate a una segnalazione.
 * Ogni immagine contiene un URL o path e fa riferimento alla segnalazione associata.
 */

const mongoose = require('mongoose');

const immagineSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID dell\'immagine è obbligatorio']
    },
    segnalazione: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segnalazione',
        required: [true, 'Il riferimento alla segnalazione è obbligatorio']
    },
    url: {
        type: String,
        required: [true, 'L\'URL dell\'immagine è obbligatorio']
    }
}, { timestamps: true });

module.exports = mongoose.model('Immagine', immagineSchema);