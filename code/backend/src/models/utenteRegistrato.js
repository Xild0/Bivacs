const mongoose = require('mongoose');

const Utente = require('./utente');

const utenteRegistratoSchema = new mongoose.Schema(
{
    nome: {
        type: String,
        required: [true, 'Il nome dell\'utente registrato è obbligatorio']
    },
    cognome: {
        type: String,
        required: [true, 'Il cognome dell\'utente registrato è obbligatorio']
    },
    dataNascita: {
        type: Date,
        required: [true, 'La data di nascita è obbligatoria']
    },
    preferiti: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bivacco'
    }]
},
{
    timestamps: true
});

// utenteRegistrato extends utente with discriminator
module.exports = Utente.discriminator('UtenteRegistrato', utenteRegistratoSchema);
