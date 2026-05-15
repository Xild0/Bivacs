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
    // controllo per bloccare token undefined o null
    if (!token || token === 'undefined' || token === 'null'){
        return res.status(401).json({ errore: 'Formato token non valido.' });
    }

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
/**
 * Middleware per verificare se l'utente ha i privilegi di amministratore.
 * Da usare SEMPRE dopo protectRoute.
 */
const isStaff = (req, res, next) => {
   const tipoUtente = req.utente.discriminator;

    if (tipoUtente === 'SuperUser' || tipoUtente === 'SupportoTecnico') {
        next(); // Autorizzato
    } else {
        return res.status(403).json({ 
            errore: 'Accesso negato. Solo la SAT, gli Enti o il Supporto Tecnico possono accedere.' 
        });
    }
};

// Esportiamo entrambi
module.exports = { protectRoute, isStaff };
