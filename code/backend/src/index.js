/**
 * @file index.js
 * @description Punto di ingresso principale del backend Bivacs.
 * Configura Express, connessione MongoDB, middleware globali e registrazione delle route API.
 */

/**
 * Configurazione DNS custom per evitare problemi di risoluzione
 * su alcune reti/università durante le chiamate esterne.
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

/**
 * DA LASCIARE PER EVITARE PROBLEMI DI COMPATIBILITà
 */
const crypto = require('crypto');
global.crypto = crypto.webcrypto || crypto;

// importing libraries
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('./config/db');

// importazione delle route
const bivacchiRoute = require('./routes/bivacchi');
const recensioniRoute = require('./routes/recensioniRoute');
const autenticazioneRoute = require('./routes/autenticazione')
const profiloRoute = require('./routes/profilo');
const percorsiRoutes = require('./routes/percorsi');
const segnalazioniRoute = require('./routes/segnalazioniRoute');

/**
 * Inizializzazione applicazione Express.
 */

const app = express();

/**
 * Middleware globali:
 * - CORS per richieste cross-origin
 * - parsing JSON
 * - esposizione statica della cartella uploads
 */

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// registrazione delle route API
// tutte le richieste a /api/v1/bivacchi vengono gestite da bivacciRouter
app.use('/uploads', express.static('uploads'));
app.use('/api/v1/bivacchi', bivacchiRoute);
app.use('/api/v1/recensioni', recensioniRoute);
app.use('/api/v1/auth', autenticazioneRoute);
app.use('/api/v1/profilo', profiloRoute);
app.use('/api/v1/percorsi', percorsiRoutes);
app.use('/api/v1/segnalazioni', segnalazioniRoute);

/**
 * Route di test per verificare che il server sia online.
 *
 * @route GET /
 * @param {import('express').Request} req - Richiesta HTTP.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {void}
 */

app.get('/', (req, res) => {
    res.send('Server Bivacs online');
});

// avvio del server
const PORT = process.env.PORT || 5000;

/**
 * Avvio asincrono del server:
 * - connessione a MongoDB
 * - apertura server Express sulla porta configurata
 */

(async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log('Server avviato sulla porta ' + PORT);
    });
})();