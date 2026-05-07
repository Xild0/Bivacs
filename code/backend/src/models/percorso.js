const mongoose = require('mongoose');

const percorsoSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID del percorso è obbligatorio']
    },
    bivacco: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco',
        required: [true, 'Il riferimento al bivacco è obbligatorio']
    },
    tipo: {
        type: String,
        enum: ['ottimale', 'panoramico'],
        default: 'ottimale'
    },
    gpxFile: {
        type: String,
        required: [true, 'Il file del percorso è obbligatorio']
    },
    dislivello: {
        type: Number,
        required: [true, 'Dislivello obbligatorio']
    },
    difficolta: {
        type: String,
        enum: ['T', 'E', 'EE', 'EEA']
    },
    lunghezza: {
        type: Number,
        required: [true, 'La lunghezza del percorso è obbligatoria']
    },
    durataStimata: {
        type: Number,
        required: [true, 'La durata stimata è obbligatoria']
    }
}, { timestamps: true });

module.exports = mongoose.model('Percorso', percorsoSchema);