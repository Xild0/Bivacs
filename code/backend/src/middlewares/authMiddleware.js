/**
 * @file authMiddleware.js
 * @description Middleware per la protezione delle rotte tramite verifica del token JWT.
 */

const jwt = require('jsonwebtoken');

/**
 * Verifica la validità del token presente nell'header Authorization.
 * Se il token è valido estrae i dati dell'utente e li aggiunge a req.
 * In caso contrario restituisce errore 401.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */

const protectRoute = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ errore: 'Accesso negato. Token mancante o non valido.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token || token === 'undefined' || token === 'null'){
        return res.status(401).json({ errore: 'Formato token non valido.' });
    }

    try {
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
 * Verifica che l'utente autenticato abbia privilegi staff.
 * Sono autorizzati solo utenti con discriminator `SuperUser` o `SupportoTecnico`.
 * Deve essere usato dopo `protectRoute`, perché legge `req.utente`.
 *
 * @param {import('express').Request} req - Oggetto richiesta Express con dati utente già decodificati.
 * @param {import('express').Response} res - Oggetto risposta Express.
 * @param {import('express').NextFunction} next - Funzione per passare al middleware successivo.
 * @returns {void}
 */

const isStaff = (req, res, next) => {
   const tipoUtente = req.utente.discriminator;

    if (tipoUtente === 'SuperUser' || tipoUtente === 'SupportoTecnico') {
        return next(); 
    } else {
        return res.status(403).json({ 
            errore: 'Accesso negato. Solo la SAT, gli Enti o il Supporto Tecnico possono accedere.' 
        });
    }
};

/**
 * Verifica che l'utente autenticato abbia i privilegi di SuperUser
 * @param {import('express').Request} req - Oggetto richiesta Express con dati utente già decodificati.
 * @param {import('express').Response res - Oggetto risposta Express.
 * @param {import('express').NextFunction next - Funzione per passare al middleware successivo.
 * @returns {void}
 */
const isSuperUser = (req, res, next) => {
    if(req.utente.discriminator === 'SuperUser'){
        return next();
    }
    return res.status(403).json({
        errore: "Accesso negato. Solo SuperUser posso accedere"
    });
};


// Esportiamo tutto
module.exports = { protectRoute, isStaff, isSuperUser };
