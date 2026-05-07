const mongoose = require('mongoose'); 

const datoMeteoSchema = new mongoose.Schema({
    id: {
        type: Number, 
        required: [true, 'l\'ID del dato meteo è obbligatorio']
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
        required: [true, 'Precitipazioni obbligatorie']
    }, 
    allertaPAT: {
        type: Boolean
    }, 
    livelloRischio: {
        type: String
    }, 
    aggiornato: {
        type: Date
    }
}, 
{
    timestamps: true
});

module.exports = mongoose.model('datoMeteo', datoMeteoSchema);