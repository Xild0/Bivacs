const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        /**
         * controllo di sicurezza per le variabili di ambiente
         */
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri){
            throw new Error("La variabile MONGO_URI non è definita nel file .env");
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connesso con successo!');
    } catch (error) {
        /**
         * controllo del tipo di errore
         */
        if (error instanceof Error){
            console.error('Errore di connessione a MongoDB:', error.message);
        } else {
            console.error('Errore di connessione a MongoDB: errore sconosciuto');
        }
        process.exit(1); // Ferma il server in caso di errore
    }
};

module.exports = connectDB;