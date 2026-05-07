const mongoose = require('mongoose');

const logAPISchema = new mongoose.Schema(
{
    id: {
        type: Number,
        required: [true, 'L\'ID della chiamata API è obbligatoria']
    }, 
    provider: {
        type: String, 
        required: [true, 'Il provider della chimata API è obbligatorio']
    },  
    esito: {
        type: Boolean, 
        required: [true, 'L\'esito della chiamata API è obbligatorio']
    }, 
    dettaglioErrore: {
        type: String, 
        requied: [true, 'L\'errore della chiamata API è obbligatorio']
    }
}, 
{
    timestamps: true
}); 

module.exports = mongoose.model('logAPI', logAPISchema);