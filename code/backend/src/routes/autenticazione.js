/**
 * @file autenticazione.js
 * @description file che gestisce tutte le operazioni inerenti alla
 * registrazione, autorizzazione e login del profilo
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Utente = require('../models/utente');
const UtenteRegistrato = require('../models/utenteRegistrato');
const protectRoute = require('../middlewares/authMiddleware');
const inviaEmail = require('../utils/emailService');
const crypto = require('crypto');
const router = express.Router();

/**
 * Registra un nuovo utente nel Database.
 * * Controlla che i campi obbligatori siano presenti, verifica che l'email
 * non sia già in uso, esegue l'hashing della password e salva il nuovo
 * UtenteRegistrato nel database.
 * * @route POST /api/v1/auth/register
 * @param {import('express').Request} req - Oggetto richiesta HTTP. Il body deve contenere: id, nome, cognome, email, password, dataNascita.
 * @param {import('express').Response} res - Oggetto risposta HTTP.
 * @returns {Promise<void>} JSON con messaggio di successo e i dati base dell'utente, oppure un messaggio di errore.
 */
router.post('/register', async (req, res) => {
    console.log('Dati in arrivo da postman:', req.body);

    try { 
        // estrazione dati dal body 
        const { id, nome, cognome, email, password, dataNascita } = req.body;

        // controllo dei campi obbligatori
        if (!id || !nome || !cognome || !email || !password || !dataNascita) {
            return res.status(400).json({ errore: 'Tutti i campi sono obbligatori' });
        }

        // controllo mail nel Database
        const utenteEsistente = await UtenteRegistrato.findOne({ email: email });
        if (utenteEsistente) { 
            return res.status(409).json({ errore: 'Esiste già un account con questa mail' });
        }

        // hashing della password 
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const verificaToken = crypto.randomBytes(32).toString('hex');

        // creazione istanza UtenteRegistrato
        const nuovoUtente = new UtenteRegistrato({
            id: id, 
            nome: nome, 
            cognome: cognome, 
            email: email, 
            passwordHash: hashedPassword,
            dataNascita: new Date(dataNascita), 
            emailToken: verificaToken, 
            isVerified: false
        });
        await nuovoUtente.save();

        /**
         * creazione della mail da inviare automaticamente
         * mediante il servizio "inviaEmail"
         */
        const linkVerifica = `http://localhost:5000/api/v1/auth/verify-email?token=${verificaToken}`;
        const htmlContent = `
            <h1>Benvenuto su Bivacs!</h1>
            <p>Ciao ${nome}, clicca sul pulsante qui sotto per confermare la tua email:</p>
            <a href=${linkVerifica}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Conferma account
            </a>
        `;
        await inviaEmail(email, "Benvenuto! Conferma la tua email", htmlContent); 

        res.status(201).json({
            message: 'Utente registrato con successo', 
            utente: {
                id: nuovoUtente.id, 
                nome: nuovoUtente.nome,
                cognome: nuovoUtente.cognome,
                email: nuovoUtente.email, 
                discriminator: nuovoUtente.discriminator
            }
        });
    } catch (error) {
        console.error('Errore durante la registrazione:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({ errore: error.message });
        }

        res.status(500).json({ errore: 'Errore interno del server' });
    }
});

/**
 * Effettua il login di un utente esistente.
 * * Riceve email e password, cerca l'utente nel DB 
 * e confronta la password con l'hash salvato. 
 * In caso di successo genera un token JWT valido per 2 ore.
 * * @route POST /api/v1/auth/login
 * @param {import('express').Request} req - Oggetto richiesta HTTP. Il body deve contenere: email, password.
 * @param {import('express').Response} res - Oggetto risposta HTTP.
 * @returns {Promise<void>} JSON contenente il Token JWT se le credenziali sono valide, oppure un errore 400/401.
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ errore: 'Email e password obbligatorie' });
        }
        
        const utenteTrovato = await Utente.findOne({ email: email });
        
        if (!utenteTrovato) {
            return res.status(401).json({ errore: 'Credenziali non valide' }); // Messaggio generico per sicurezza
        }
        
        console.log('Email trovata nel Database: ', utenteTrovato.email);

        // confronto password in chiaro con hashing nel Database
        const verifica = await bcrypt.compare(password, utenteTrovato.passwordHash);
        if (!verifica) {
            return res.status(401).json({ errore: 'Credenziali non valide' });
        }

        // generazione token JWT
        const Dati = {
            id: utenteTrovato.id, 
            mongoId: utenteTrovato._id, 
            ruolo: utenteTrovato.discriminator
        };

        const token = jwt.sign(Dati, process.env.JWT_SECRET, { expiresIn: '2h' });

        res.status(200).json({
            messaggio: 'Login effettuato con successo',
            token: token
        });
    } catch (error) {
        console.error('Errore durante il login:', error);
        res.status(500).json({ errore: 'Errore interno del server' });
    }
});

/**
 * Verifica l'email dell'utente confrontando il token presente nell'URL:
 * se il token è valido, imposta l'utente come verificato e rimuove il token dal DB.
 * @route GET /api/v1/auth/verify-email
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
router.get('/verify-email', async (req, res) => {
    try {
        const tokenSporco = req.query.token;
        const tokenUrl = tokenSporco.replace(/['"]/g, '');
        console.log("Token ricevuto da URL: ", tokenUrl);

        if (!tokenUrl) {
            return res.status(400).json({ errore: 'Nessun token di verifica fornito.' });
        }

        const utente = await UtenteRegistrato.findOne({ emailToken: tokenUrl });

        if (!utente) {
            return res.status(400).json({ errore: 'Token non valido, scaduto o account già verificato.' });
        }

        // Account attivato
        utente.isVerified = true;
        
        utente.emailToken = null; 

        await utente.save();

        /**
         * NOTA PER IL FUTURO (Frontend):
         * Quando avrete le pagine HTML pronte, invece di rispondere con un JSON
         * potrai fare un reindirizzamento alla pagina di successo, es:
         * return res.redirect('http://localhost:3000/login?verificato=true');
         */
        res.status(200).json({ messaggio: 'Email verificata con successo! Ora puoi effettuare il login.' });

    } catch (error) {
        console.error('Errore durante la verifica dell\'email:', error);
        res.status(500).json({ errore: 'Errore interno del server' });
    }
});

/**
 * Necessario per la fase di testing: rotta di prova
 */
router.get('/profilo-test',protectRoute, (req, res) =>{
    res.status(200).json({
        messaggio: 'Accesso consentito! Token valido.', 
        dati_utente_token: req.utente
    });
});

/**
 * Genera un token di reset e invia la mail all'utente.
 * @route POST /api/v1/auth/forgot-password
 */
router.post('/recupero_password', async (req, res) => {
    const { email } = req.body;
    try {
        const utente = await Utente.findOne({ email });
        if (!utente) return res.status(404).json({ errore: "Email non trovata" });

        const resetToken = crypto.randomBytes(32).toString('hex');
        utente.resetPassToken = resetToken;
        utente.resetPassExpires = Date.now() + 3600000; // 1 ora da adesso
        await utente.save();

        const linkReset = `http://localhost:3000/reset-password/${resetToken}`; // Link che porterà al frontend
        await inviaEmail(email, "Recupero Password Bivacs", `Clicca qui per resettare: ${linkReset}`);

        res.json({ messaggio: "Email di recupero inviata!" });
    } catch (error) {
        res.status(500).json({ errore: "Errore nel reset password" });
    }
});

/**
 * Endpoint per impostare la nuova password usando il token ricevuto via mail
 * @route POST /api/v1/auth/reset-password/:token
 */
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { nuovaPassword } = req.body;

        // controllo aggiuntivo: il token su resetPassExpires non deve essere scaduto
        const utente = await Utente.findOne({
            resetPassToken: token,
            resetPassExpires: { $gt: Date.now() }
        });

        if (!utente) {
            return res.status(400).json({ errore: "Token non valido o scaduto." });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(nuovaPassword, saltRounds);

        // aggiornamento della password e reset dei token
        utente.passwordHash = hashedPassword;
        utente.resetPassToken = undefined;
        utente.resetPassExpires = undefined;

        await utente.save();

        res.status(200).json({ messaggio: "Password aggiornata con successo! Ora puoi effettuare il login." });
    } catch (error) {
        console.error("Errore nel reset password:", error);
        res.status(500).json({ errore: "Errore interno del server" });
    }
});


module.exports = router;