const mongoose = require('mongoose');
const Utente = require('./utente');

const superUserSchema = new mongoose.Schema(
{
    ente: {
        type: String,
        required: [true, 'L\'ente del SuperUser è obbligatorio'],
        enum: ['Provincia di Trento', 'SAT', 'Comune', 'Regione Trentino-Alto Adige']
    },
    livelloAuth: {
        type: Number,
        required: [true, 'Il livello di autorizzazione è obbligatorio'],
        min: [1, 'Livello minimo è 1'],
        max: [5, 'Livello massimo è 5']
    }
},
{
    timestamps: true
});

// superUser extends utente
module.exports = Utente.discriminator('SuperUser', superUserSchema);
