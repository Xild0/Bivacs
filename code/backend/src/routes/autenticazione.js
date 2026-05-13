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

        // creazione istanza UtenteRegistrato
        const nuovoUtente = new UtenteRegistrato({
            id: id, 
            nome: nome, 
            cognome: cognome, 
            email: email, 
            passwordHash: hashedPassword,
            dataNascita: new Date(dataNascita)  
        });
        await nuovoUtente.save();
        
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
        const payloadDati = {
            id: utenteTrovato.id, 
            mongoId: utenteTrovato._id, 
            ruolo: utenteTrovato.discriminator
        };

        const token = jwt.sign(payloadDati, process.env.JWT_SECRET, { expiresIn: '2h' });

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
 * Necessario per la fase di testing: rotta di prova
 */
router.get('/profilo-test',protectRoute, (req, res) =>{
    res.status(200).json({
        messaggio: 'Accesso consentito! Token valido.', 
        dati_utente_token: req.utente
    });
});

module.exports = router;