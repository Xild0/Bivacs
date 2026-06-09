/**
 * @file db.js
 * @description Configurazione della connessione a MongoDB tramite Mongoose.
 */

const mongoose = require('mongoose');

/**
 * Connette l'applicazione al database MongoDB tramite Mongoose.
 *
 * Legge l'URI di connessione dalla variabile d'ambiente `MONGO_URI`.
 * In caso di errore termina il processo Node.js per evitare
 * l'avvio del server senza connessione al database.
 *
 * @async
 * @function connectDB
 * @returns {Promise<void>}
 */

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri){
            throw new Error("La variabile MONGO_URI non è definita nel file .env");
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connesso con successo!');
    } catch (error) {
        if (error instanceof Error){
            console.error('Errore di connessione a MongoDB:', error.message);
        } else {
            console.error('Errore di connessione a MongoDB: errore sconosciuto');
        }
        process.exit(1); // Ferma il server in caso di errore
    }
};

module.exports = connectDB;