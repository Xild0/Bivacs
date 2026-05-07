const mongoose = require ('mongoose'); 

const recensioneSchema = new mongoose.Schema({
   id: {
        type: Number, 
        required: [true, 'L\'ID della recensione è obbligatorio']
   }, 
   rating: {
        type: Number, 
        required: [true, 'Il rating della recensione è obbligatorio'],
        min: [1, 'Rating non valido'], 
        max: [5, 'Rating non valido']
   }, 
   commento: {
        type: String, 
   }, 
   anonima: {
        type: Boolean, 
        default: true
   }
}, 
{
     timestamps: true
});

module.exports = mongoose.model('recensione', recensioneSchema);