// importing libraries
const express = require ('express');
const cors = require ('cors');
require ('dotenv').config(); 
const connectDB = require('./config/db');

// init app with express
const app = express();

app.use(cors());
app.use(express.json());

// test route
app.get('/', (req, res) => {
    res.send('Server Bivacs online');
});

// server launch
const PORT = process.env.PORT || 5000;

(async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log('Server avviato sulla porta ' + PORT);
    });
})();

