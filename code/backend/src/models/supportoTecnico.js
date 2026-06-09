/**
 * @file supportoTecnico.js
 * @description Modello Mongoose per gli utenti con ruolo SupportoTecnico.
 * Estende il modello base Utente tramite discriminator Mongoose.
 */

const mongoose = require('mongoose');
const Utente = require('./utente');

/**
 * Schema dei dati aggiuntivi associati a un utente SupportoTecnico.
 *
 * @type {mongoose.Schema}
 */

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

// SupportoTecnico estende il modello base Utente tramite discriminator.
module.exports = Utente.discriminator('SupportoTecnico', supportoTecnicoSchema);
