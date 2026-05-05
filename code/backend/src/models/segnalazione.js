const mongoose = require('mongoose');

const segnalazioneSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID della segnalazione è obbligatorio']
    }, 

    descrizione: { 
        type: String,
        required: [true, 'La descrizione della segnalazione è obbligatoria'], 
        trim: true, 
        minlength: [20, 'La descrizione deve essere almeno di 20 caratteri']
    },

    // TO DO: aggiungere obbligo inserimento foto. 
    // Sistema ibrido? L'utente carica la foto dal frontend, 
    // la foto viene salvata in locale e nel database viene salvato solo il link alla foto.
    // Vi convince oppure no? 
    // Alternativa: salvare la foto direttamente nel database ma è poco efficiente in termine di spazio.
    foto: {
        type: String,
        required: [true, 'La foto della segnalazione è obbligatoria']
    },


    statoSegnalazione: {
        type: String,
        required: true,
        enum: ['inviata', ' presa_in_carico', 'in_corso', 'risolta', 'archiviata']
    }
}, 
{
    timestamps: true
});

module.exports = mongoose.model('Segnalazione', segnalazioneSchema);