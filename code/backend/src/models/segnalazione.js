const mongoose = require('mongoose');

const segnalazioneSchema = new mongoose.Schema({
    utenteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    descrizione: { 
        type: String,
        required: [true, 'La descrizione della segnalazione è obbligatoria'], 
        trim: true, 
        minlength: [20, 'Sii più specifico: la descrizione deve avere almeno 20 caratteri']
    },
    foto: {
        type: String, // Qui andrà l'URL o il path del file
        required: [true, 'La foto della segnalazione è obbligatoria']
    },
    

    // TO DO: aggiungere obbligo inserimento foto. 
    // Sistema ibrido? L'utente carica la foto dal frontend, 
    // la foto viene salvata in locale e nel database viene salvato solo il link alla foto.
    // Vi convince oppure no? 
    // Alternativa: salvare la foto direttamente nel database ma è poco efficiente in termine di spazio.

    statoSegnalazione: {
        type: String,
        required: true,
        enum: ['inviata', 'presa_in_carico', 'in_corso', 'risolta', 'archiviata'],
        default: 'inviata'
    }
}, 
{
    timestamps: true
});

module.exports = mongoose.model('Segnalazione', segnalazioneSchema);