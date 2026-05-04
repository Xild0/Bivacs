const mongoose = require('mongoose');

const utenteSchema = new mongoose.Schema(
{
    id: {
        type: Number, 
        required: [true, 'L\'ID dell\'utente è obbligatorio']
    }, 
    email: {
        type: String, 
        required: [true, 'L\'email dell\'utente è obbligatoria'],
        unique: true,                                                   // molto importante per evitare duplicati nelle mail
        validate:{
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
    }
},
{ 
    timestamps: true,
    discriminatorKey: 'discriminator'
});

module.exports = mongoose.model('Utente', utenteSchema);