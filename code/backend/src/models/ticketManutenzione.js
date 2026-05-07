const mongoose = require('mongoose'); 

const ticketManutenzioneSchema = new mongoose.Schema({
    id: {
        type: Number, 
        required: [true, 'L\'ID del ticket di manutenzione è obbligatorio']
    }, 
    stato: {
        type: String, 
        required: [true, 'Lo stato del ticket è obbligatorio'], 
        enum: ['aperto', 'in_lavorazione', 'chiuso','archiviato']
    }, 
    priorita:{
        type: Number, 
        min: [1, 'Valore non accettabile, min. 1, max. 10'],
        max: [10, 'Valore non accettabile, min. 1, max. 10']
    },
    dataApertura: {
        type: Date, 
        required: true
    }, 
    DataChiusura: {
        type: Date, 
        required: true
    }, 
    note: {
        type: String
    }
}, 
{
    timestamps: true
}); 

module.exports = mongoose.model('ticketManutenzione', ticketManutenzioneSchema);