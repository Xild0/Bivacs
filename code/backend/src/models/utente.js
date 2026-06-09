/**
 * @file utente.js
 * @description Modello Mongoose base per gli utenti del sistema.
 *
 * Include:
 * - credenziali e lingua preferita;
 * - verifica account tramite email;
 * - token per recupero password;
 * - discriminator per la gestione dei ruoli;
 * - richieste di promozione a SupportoTecnico e SuperUser.
 */

const mongoose = require('mongoose');

/**
 * Schema base degli utenti del sistema.
 *
 * @type {mongoose.Schema}
 */

const utenteSchema = new mongoose.Schema(
{
    id: {
        type: Number, 
        required: [true, 'L\'ID dell\'utente è obbligatorio'],
        unique: true
    }, 
    email: {
        type: String, 
        required: [true, 'L\'email dell\'utente è obbligatoria'],
        unique: true,                                                 
        validate:{
            /**
             * Verifica la validità sintattica dell'indirizzo email.
             *
             * @param {string} v - Email da validare.
             * @returns {boolean}
             */
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'L\'email deve essere valida e contenere @'
        }
    }, 
    passwordHash: {
        type: String, 
        required: [true, 'La password dell\'utente è obbligatoria']
    },
    lingua: {
        type: String,
        default: 'it',
        enum: ['it', 'en', 'de', 'fr']
    },
    discriminator: {
        type: String,
        required: true,
        enum: ['UtenteRegistrato', 'SuperUser', 'SupportoTecnico']
    },
    isVerified: {
        type: Boolean, 
        default: false
    }, 
    emailToken: {
        type: String
    }, 
    resetPassToken: {
        type: String
    }, 
    resetPassExpires: {
        type: Date
    },
    richiestaSupportoTecnico: {
    stato: {
        type: String,
        enum: ['nessuna', 'in_attesa', 'approvata', 'rifiutata'],
        default: 'nessuna'
    },
    motivo: {
        type: String,
        default: ''
    },
    matricolaRichiesta: {
        type: String,
        default: ''
    }
    },
    richiestaSuperUser:{
        stato:{
            type: String, 
            enum: ['nessuna', 'in_attesa', 'approvata', 'rifiutata'],
            default: 'nessuna'
        },
        motivo:{
            type: String, 
            default: ''
        }
        
    }
},
{ 
    timestamps: true,
    discriminatorKey: 'discriminator'
});

module.exports = mongoose.model('Utente', utenteSchema);