// importing libraries
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('./config/db.ts');

// importazione delle route
const bivacchiRouter = require('./routes/bivacchi');
const recensioniRoute = require('./routes/recensioniRoute');
// init app con express
const app = express();

app.use(cors());
app.use(express.json());

// registrazione delle route API
// tutte le richieste a /api/v1/bivacchi vengono gestite da bivacciRouter
app.use('/api/v1/bivacchi', bivacchiRouter);
app.use('/api/v1/recensioni', recensioniRoute);
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