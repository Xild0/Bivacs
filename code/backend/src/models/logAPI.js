const mongoose = require('mongoose');

const logAPISchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID della chiamata API è obbligatorio']
    },
    provider: {
        type: String,
        required: [true, 'Il provider della chiamata API è obbligatorio']
    },
    esito: {
        type: Boolean,
        required: [true, 'L\'esito della chiamata API è obbligatorio']
    },
    dettaglioErrore: {
        type: String
        // non required: presente solo in caso di errore
    }
}, { timestamps: true });

module.exports = mongoose.model('LogAPI', logAPISchema);