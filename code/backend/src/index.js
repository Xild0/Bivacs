const dns= require("dns");
dns.setServers(["8.8.8.8","1.1.1.1"]);
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
// init app con express
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// registrazione delle route API
// tutte le richieste a /api/v1/bivacchi vengono gestite da bivacciRouter
app.use('/api/v1/bivacchi', bivacchiRoute);
app.use('/api/v1/recensioni', recensioniRoute);
app.use('/api/v1/auth', autenticazioneRoute);
app.use('/api/v1/profilo', profiloRoute);
// route di test per verificare che il server sia online
app.get('/', (req, res) => {
    res.send('Server Bivacs online');
});

// avvio del server
const PORT = process.env.PORT || 5000;

(async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log('Server avviato sulla porta ' + PORT);
    });
})();