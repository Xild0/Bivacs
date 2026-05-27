/**
 * @file alert.js
 * @description Modello Mongoose per gli alert associati ai bivacchi.
 * Un alert rappresenta un avviso attivo o disattivo visibile agli utenti.
 */

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID dell\'alert è obbligatorio']
    },
    bivacco: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco',
        required: [true, 'Il riferimento al bivacco è obbligatorio']
    },
    messaggio: {
        type: String,
        required: [true, 'Il messaggio dell\'alert è obbligatorio']
    },
    attivo: {
        type: Boolean,
        required: [true, 'Lo stato dell\'alert è obbligatorio'],
        default: true
    }
}, { timestamps: true });

alertSchema.revoca = async function(){
    this.attivo = false;
    return await this.save()
};

module.exports = mongoose.model('Alert', alertSchema);      