/**
 * @file app.js
 * @description Istanza Express dell'applicazione Bivacs, separata dall'avvio del
 * server HTTP/Socket.IO per consentire i test di integrazione con supertest.
 *
 * L'avvio effettivo (connessione DB, listen, Socket.IO) resta in index.js.
 */

const express = require('express');
const cors = require('cors');

const bivacchiRoute = require('./routes/bivacchi');
const recensioniRoute = require('./routes/recensioniRoute');
const autenticazioneRoute = require('./routes/autenticazione');
const profiloRoute = require('./routes/profilo');
const percorsiRoutes = require('./routes/percorsi');
const segnalazioniRoute = require('./routes/segnalazioniRoute');
const meteoRoute = require('./routes/meteo');
const supportoRoute = require('./routes/supporto');
const ticketRoute = require('./routes/ticket');
const alertRoute = require('./routes/alert');

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Middleware globali: CORS, parsing JSON, cartella statica uploads.
 */
app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json());

app.use('/uploads', express.static('uploads'));

/**
 * Registrazione delle route API con prefisso /api/v1.
 */
app.use('/api/v1/bivacchi', bivacchiRoute);
app.use('/api/v1/recensioni', recensioniRoute);
app.use('/api/v1/auth', autenticazioneRoute);
app.use('/api/v1/profilo', profiloRoute);
app.use('/api/v1/percorsi', percorsiRoutes);
app.use('/api/v1/segnalazioni', segnalazioniRoute);
app.use('/api/v1/meteo', meteoRoute);
app.use('/api/v1/supporto', supportoRoute);
app.use('/api/v1/ticket', ticketRoute);
app.use('/api/v1/alert', alertRoute);

/**
 * Health check.
 *
 * @route GET /
 * @access Public
 */
app.get('/', (req, res) => {
    res.send('Server Bivacs online');
});

module.exports = app;
