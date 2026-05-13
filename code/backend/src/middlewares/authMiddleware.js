/**
 * @file authMiddleware.js
 * @description Middleware per la protezione delle rotte tramite verifica del token JWT.
 */

const jwt = require('jsonwebtoken');

/**
 * Verifica la validità del token presente nell'header Authorization.
 * * Se il token è valido, estrae i dati dell'utente e li aggiunge all'oggetto `req`,
 * in caso contrario, nega l'accesso con un errore 401.
 * * @param {import('express').Request} req - Oggetto richiesta Express.
 * @param {import('express').Response} res - Oggetto risposta Express.
 * @param {import('express').NextFunction} next - Funzione per passare al middleware successivo.
 * @returns {void}
 */
const protectRoute = (req, res, next) => {
    // recupero dell'header authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ errore: 'Accesso negato. Token mancante o non valido.' });
    }

    // estrazione token
    const token = authHeader.split(' ')[1];

    try {
        // verifica del token tramite chiave segreta definita nel file .env
        const extracted = jwt.verify(token, process.env.JWT_SECRET);
        
        /**
         * Aggiungiamo i dati estratti all'oggetto richiesta, in questo modo
         * le rotte successive sapranno chi è l'utente che si sta connettendo
         */
        req.utente = extracted; 
        
        next(); 
    } catch (error) {
        console.error('Errore validazione token:', error.message);
        res.status(401).json({ errore: 'Sessione scaduta o token non valido. Effettua nuovamente il login.' });
    }
};

module.exports = protectRoute;