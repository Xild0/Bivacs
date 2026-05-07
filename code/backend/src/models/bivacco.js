const mongoose = require('mongoose');

const bivaccoSchema = new mongoose.Schema(
{
    id: {
        type: Number, 
        required: [true, 'L\'ID del bivacco è obbligatorio']
    },
    nome: { 
        type: String, 
        required: [true, 'Il nome del bivacco è obbligatorio'] 
        },
    latitudine: { 
        type: Number, 
        required: true, 
        min: [45.6, 'Coordinate fuori dal Trentino'], 
        max: [46.6, 'Coordinate fuori dal Trentino']
        },
    longitudine: {
        type: Number, 
        required: true,
        min: [10.4, 'Coordinate fuori dal Trentino'],
        max: [12.0, 'Coordinate fuori dal Trentino']
    },
    altitudine: {
        type: Number, 
        required: [true, 'L\'altitudine del bivacco è obbligatoria']
    },
    postiLetto: {
        type: Number, 
        required: [true, 'Il numero di posti letto è obbligatorio'],
        default: 0
    },
    dotazioni: {
        type: String,
        default: ''
    }, 
    zona: {
        type: String,
        required: [true, 'La zona del bivacco è obbligatoria']
    }, 
    emergenza: { 
        type: Boolean, 
        default: false
    },
    acquaPresente: {
        type: Boolean,
        default: true
    },
    legnaDisponibile: {
        type: Boolean,
        default: true
    },
    ultimoCheckStato: {
    type: Date,
    default: Date.now
    }
},
{
    timestamps: true
});

module.exports = mongoose.model('Bivacco', bivaccoSchema);

