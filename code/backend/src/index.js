/**
 * @file index.js
 * @description Bootstrap del server backend Bivacs.
 *
 * Include:
 * - configurazione DNS e WebCrypto;
 * - caricamento variabili d'ambiente;
 * - import dell'istanza Express (app.js);
 * - configurazione di Socket.IO;
 * - connessione a MongoDB;
 * - avvio del server HTTP.
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

/**
 * Configura WebCrypto globale per compatibilità con librerie che richiedono
 * global.crypto in Node.js.
 */
const crypto = require('crypto');
global.crypto = crypto.webcrypto || crypto;

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');

/**
 * Crea il server HTTP a partire dall'app Express e collega Socket.IO.
 */
const httpServer = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const socketServer = new Server(httpServer, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
    }
});

app.set('socketServer', socketServer);

socketServer.on('connection', (socket) => {
    console.log('Nuovo utente connesso (Socket ID:', socket.id, ')');
});

const PORT = process.env.PORT || 5000;

/**
 * Avvia il server backend: connessione a MongoDB e listen sulla porta configurata.
 */
(async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        console.log('Server avviato sulla porta ' + PORT);
    });
})();
