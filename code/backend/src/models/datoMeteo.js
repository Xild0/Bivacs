const mongoose = require('mongoose');

const datoMeteoSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID del dato meteo è obbligatorio']
    },
    bivacco: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco',
        required: [true, 'Il riferimento al bivacco è obbligatorio']
    },
    temperatura: {
        type: Number,
        required: [true, 'Temperatura obbligatoria']
    },
    vento: {
        type: Number,
        required: [true, 'Vento obbligatorio']
    },
    precipitazioni: {
        type: Number,
        required: [true, 'Precipitazioni obbligatorie']
    },
    allertaPAT: {
        type: Boolean,
        default: false
    },
    livelloRischio: {
        type: String,
        enum: ['basso', 'moderato', 'marcato', 'forte', 'molto_forte']
    },
    aggiornato: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('DatoMeteo', datoMeteoSchema);