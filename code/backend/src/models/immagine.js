const mongoose = require('mongoose');

const immagineSchema = new mongoose.Schema({
    id: {
        type: Number, 
        required: [true, 'L\'ID dell\'immagine è obbligatorio']
    }, 
    url: {
        type: String,
        required: [true, 'l\'URL dell\'immagine è obbligatorio']
    }
}, 
{
    timestamps: true
}); 

module.exports = mongoose.model('immagine', immagineSchema);