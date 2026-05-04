const mongoose = require('mongoose');
const Utente = require('./utente');

const supportoTecnicoSchema = new mongoose.Schema(
{
    matricola: {
        type: String,
        required: [true, 'La matricola del SupportoTecnico è obbligatoria'],
        unique: true
    }
},
{
    timestamps: true
});

// supportoTecnico extends utente
module.exports = Utente.discriminator('SupportoTecnico', supportoTecnicoSchema);
