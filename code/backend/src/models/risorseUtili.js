const mongoose = require ('mongoose'); 

const risorseUtiliSchema = new mongoose.Schema({
    id: {
        type: Number, 
        required: [true, 'L\'ID delle risorse è obbligatorio']
    }, 
    acqua: {
        type: String, 
        required: [true, 'Le info sull\'acqua sono obbligatorie'], 
        enum: ['disponibile', 'scarsa', 'assente', 'non_verificata']
    },
    legna: {
        type: String, 
        required: [true, 'Le info sulla legna sono obbligatorie'], 
        enum: ['disponibile', 'scarsa', 'assente', 'non_verificata']
    }
}, 
{
    timestamps: true
});

module.exports = mongoose.model('risorseUtili', risorseUtiliSchema);