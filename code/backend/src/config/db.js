const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connesso con successo!');
    } catch (error) {
        console.error('Errore di connessione a MongoDB:', error.message);
        process.exit(1); // Ferma il server in caso di errore
    }
};

module.exports = connectDB;