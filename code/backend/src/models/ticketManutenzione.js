/**
 * @file ticketManutenzione.js
 * @description Modello Mongoose per i ticket di manutenzione generati da segnalazioni.
 * Tiene traccia dello stato, priorità, data di apertura, eventuale chiusura e note operative.
 */

const mongoose = require('mongoose');

/**
 * Schema che rappresenta un ticket di manutenzione
 * generato a partire da una segnalazione.
 *
 * @type {mongoose.Schema}
 */

const ticketManutenzioneSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID del ticket di manutenzione è obbligatorio']
    },
    segnalazione: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Segnalazione',
        required: [true, 'Il riferimento alla segnalazione è obbligatorio']
    },
    stato: {
        type: String,
        required: [true, 'Lo stato del ticket è obbligatorio'],
        enum: ['aperto', 'in_lavorazione', 'chiuso', 'archiviato'],
        default: 'aperto'
    },
    priorita: {
        type: Number,
        min: [1, 'Valore non accettabile, min. 1, max. 10'],
        max: [10, 'Valore non accettabile, min. 1, max. 10'],
        default: 5
    },
    dataApertura: {
        type: Date,
        default: Date.now
    },
    dataChiusura: {
    type: Date
},
    note: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('TicketManutenzione', ticketManutenzioneSchema);