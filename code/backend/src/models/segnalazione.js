const mongoose = require('mongoose');

const segnalazioneSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: [true, 'L\'ID della segnalazione è obbligatorio']
    }, 

    // TO DO: aggiungere verifica segnalazione non vuota
    descrizione: { 
        type: String,
        required: [true, 'La descrizione della segnalazione è obbligatoria']
    },

    // TO DO: aggiungere obbligo inserimento foto


    statoSegnalazione: {
        type: String,
        required: true,
        enum: ['inviata', ' presa_in_carico', 'in_corso', 'risolta', 'archiviata']]
    }
}, 
{
    timestamps: true
});

module.exports = mongoose.model('Segnalazione', segnalazioneSchema);
}   