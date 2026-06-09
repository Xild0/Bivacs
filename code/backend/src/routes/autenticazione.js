/**
 * @file autenticazione.js
 * @description API REST per autenticazione e gestione account utenti.
 *
 * Include:
 * - registrazione;
 * - login;
 * - verifica email;
 * - recupero password;
 * - reset password;
 * - reinvio email di verifica.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const Utente = require('../models/utente');
const UtenteRegistrato = require('../models/utenteRegistrato');
const { protectRoute } = require('../middlewares/authMiddleware');
const inviaEmail = require('../utils/emailService');
const getNewSequence = require('../utils/getNewSequence');

const router = express.Router();

/**
 * URL utilizzati per la generazione dei link
 * di verifica account e recupero password.
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Registra un nuovo utente nel sistema.
 *
 * L'operazione:
 * - valida i dati ricevuti;
 * - verifica l'unicità dell'email;
 * - genera l'hash della password;
 * - crea l'account;
 * - invia l'email di verifica.
 *
 * @route POST /api/v1/auth/register
 * @access Public
 */

router.post('/register', async (req, res) => {
    try {
        const { nome, cognome, email, password, dataNascita } = req.body;

        if (!nome || !cognome || !email || !password || !dataNascita) {
            return res.status(400).json({
                errore: 'Tutti i campi sono obbligatori'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                errore: 'La password deve contenere almeno 8 caratteri'
            });
        }

        const emailNormalizzata = email.trim().toLowerCase();

        const utenteEsistente = await Utente.findOne({ email: emailNormalizzata });

        if (utenteEsistente) {
            return res.status(409).json({
                errore: 'Email già registrata. Accedi oppure usa il recupero password.'
            });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
    
        const verificaToken = crypto.randomBytes(32).toString('hex');
        const idAggiornato = await getNewSequence('utenteId');

        const nuovoUtente = new UtenteRegistrato({
            id: idAggiornato,
            nome,
            cognome,
            email: emailNormalizzata,
            passwordHash: hashedPassword,
            dataNascita: new Date(dataNascita),
            emailToken: verificaToken,
            isVerified: false,
            discriminator: 'UtenteRegistrato'
        });

        await nuovoUtente.save();

        const linkVerifica = `${BACKEND_URL}/api/v1/auth/verify-email?token=${verificaToken}`;
        console.log('LINK VERIFICA ACCOUNT:', linkVerifica);

        const htmlContent = `
            <h1>Benvenuto su Bivacs!</h1>
            <p>Ciao ${nome}, clicca sul pulsante qui sotto per confermare la tua email:</p>
            <a href="${linkVerifica}" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
                Conferma account
            </a>
        `;

        try {
            await inviaEmail(
                emailNormalizzata,
                'Benvenuto! Conferma la tua email',
                htmlContent
            );
        } catch (emailError) {
            console.error('Errore invio email verifica:', emailError.message);
        }

        return res.status(201).json({
            message: 'Utente registrato con successo. Controlla la mail per verificare l’account.',
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

        if (error.code === 11000) {
            return res.status(409).json({
                errore: 'Email già registrata. Accedi oppure usa il recupero password.'
            });
        }

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                errore: error.message
            });
        }

        return res.status(500).json({
            errore: 'Errore interno del server'
        });
    }
});

/**
 * Autentica un utente registrato.
 *
 * Se le credenziali sono valide genera
 * e restituisce un token JWT.
 *
 * @route POST /api/v1/auth/login
 * @access Public
 */

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                errore: 'Email e password obbligatorie'
            });
        }

        const emailNormalizzata = email.trim().toLowerCase();
        const utenteTrovato = await Utente.findOne({ email: emailNormalizzata });

        if (!utenteTrovato) {
            return res.status(404).json({
                errore: 'Utente non trovato, si prega di registrarsi.',
                codiceErrore: 'UTENTE_NON_TROVATO'
            });
        }

        if (!utenteTrovato.isVerified) {
            return res.status(403).json({
                errore: 'Devi verificare la tua mail prima di poter accedere',
                codiceErrore: 'EMAIL_NON_VERIFICATA'
            });
        }

        const verifica = await bcrypt.compare(password, utenteTrovato.passwordHash);

        if (!verifica) {
            return res.status(401).json({
                errore: 'Credenziali non valide'
            });
        }

        const datiToken = {
            id: utenteTrovato.id,
            mongoId: utenteTrovato._id,
            discriminator: utenteTrovato.discriminator
        };

        const token = jwt.sign(datiToken, process.env.JWT_SECRET, {
            expiresIn: '2h'
        });

        return res.status(200).json({
            messaggio: 'Login effettuato con successo',
            token
        });
    } catch (error) {
        console.error('Errore durante il login:', error);
        return res.status(500).json({
            errore: 'Errore interno del server'
        });
    }
});

/**
 * Conferma l'indirizzo email di un utente.
 *
 * Il token di verifica viene ricevuto tramite
 * query parameter e validato nel database.
 *
 * @route GET /api/v1/auth/verify-email
 * @access Public
 */

router.get('/verify-email', async (req, res) => {
    try {
        const tokenSporco = req.query.token;

        if (!tokenSporco) {
            return res.redirect(`${FRONTEND_URL}/?verificato=false&motivo=notoken`);
        }

        const tokenUrl = String(tokenSporco).replace(/['"]/g, '');
        const utente = await Utente.findOne({ emailToken: tokenUrl });

        if (!utente) {
            return res.redirect(`${FRONTEND_URL}/?verificato=false`);
        }

        utente.isVerified = true;
        utente.emailToken = null;

        await utente.save();

        return res.redirect(`${FRONTEND_URL}/?verificato=true`);
    } catch (error) {
        console.error('Errore durante la verifica dell email:', error);
        return res.redirect(`${FRONTEND_URL}/?verificato=false&motivo=servererror`);
    }
});

/**
 * Endpoint di test per verificare
 * il corretto funzionamento del middleware JWT.
 *
 * @route GET /api/v1/auth/profilo-test
 * @access Private
 */

router.get('/profilo-test', protectRoute, (req, res) => {
    return res.status(200).json({
        messaggio: 'Accesso consentito! Token valido.',
        dati_utente_token: req.utente
    });
});

/**
 * Genera un token temporaneo per il recupero password
 * e invia all'utente il link di reset tramite email.
 *
 * @route POST /api/v1/auth/recupero_password
 * @access Public
 */

router.post('/recupero_password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                errore: 'Email obbligatoria'
            });
        }

        const emailNormalizzata = email.trim().toLowerCase();
        const utente = await Utente.findOne({ email: emailNormalizzata });

        if (!utente) {
            return res.status(404).json({
                errore: 'Email non trovata'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');

        utente.resetPassToken = resetToken;
        utente.resetPassExpires = Date.now() + 3600000;

        await utente.save();

        const linkReset = `${FRONTEND_URL}/?reset=${resetToken}`;

        try {
            await inviaEmail(
                emailNormalizzata,
                'Recupero Password Bivacs',
                `
                <h1>Recupero password</h1>
                <p>Clicca sul link per impostare una nuova password:</p>
                <a href="${linkReset}">${linkReset}</a>
                <p>Il link scade tra 1 ora.</p>
                `
            );
        } catch (emailError) {
            console.error('Errore invio email reset password:', emailError.message);
            return res.status(502).json({
                errore: 'Impossibile inviare la mail di recupero password'
            });
        }

        return res.status(200).json({
            messaggio: 'Email di recupero inviata'
        });
    } catch (error) {
        console.error('Errore recupero password:', error);
        return res.status(500).json({
            errore: 'Errore nel reset password'
        });
    }
});

/**
 * Imposta una nuova password utilizzando
 * un token di recupero ancora valido.
 *
 * @route POST /api/v1/auth/reset-password/:token
 * @access Public
 */

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { nuovaPassword } = req.body;

        if (!nuovaPassword || nuovaPassword.length < 8) {
            return res.status(400).json({
                errore: 'La nuova password deve contenere almeno 8 caratteri'
            });
        }

        const utente = await Utente.findOne({
            resetPassToken: token,
            resetPassExpires: { $gt: Date.now() }
        });

        if (!utente) {
            return res.status(400).json({
                errore: 'Token non valido o scaduto'
            });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(nuovaPassword, saltRounds);

        utente.passwordHash = hashedPassword;
        utente.resetPassToken = undefined;
        utente.resetPassExpires = undefined;

        await utente.save();

        return res.status(200).json({
            messaggio: 'Password aggiornata con successo. Ora puoi effettuare il login.'
        });
    } catch (error) {
        console.error('Errore nel reset password:', error);
        return res.status(500).json({
            errore: 'Errore interno del server'
        });
    }
});

/**
 * Genera un nuovo token di verifica email
 * e reinvia il link di conferma all'utente.
 *
 * @route POST /api/v1/auth/resend-verification
 * @access Public
 */

router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                errore: 'Email obbligatoria'
            });
        }

        const emailNormalizzata = email.trim().toLowerCase();
        const utente = await Utente.findOne({ email: emailNormalizzata });

        if (!utente) {
            return res.status(404).json({
                errore: 'Utente non trovato'
            });
        }

        if (utente.isVerified) {
            return res.status(400).json({
                errore: 'Account già verificato'
            });
        }

        const nuovoToken = crypto.randomBytes(32).toString('hex');

        utente.emailToken = nuovoToken;
        await utente.save();

        const linkVerifica = `${BACKEND_URL}/api/v1/auth/verify-email?token=${nuovoToken}`;
        console.log('LINK REINVIO VERIFICA ACCOUNT:', linkVerifica);
        
        try {
            await inviaEmail(
                emailNormalizzata,
                'Conferma email Bivacs',
                `
                <h1>Conferma il tuo account Bivacs</h1>
                <p>Clicca sul pulsante per verificare la tua email:</p>
                <a href="${linkVerifica}" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
                    Conferma account
                </a>
                `
            );
        } catch (emailError) {
            console.error('Errore invio nuova email verifica:', emailError.message);
            return res.status(502).json({
                errore: 'Impossibile inviare la nuova email di verifica'
            });
        }

        return res.status(200).json({
            messaggio: 'Email di verifica inviata nuovamente'
        });
    } catch (error) {
        console.error('Errore resend verification:', error);
        return res.status(500).json({
            errore: 'Errore invio nuova email di verifica'
        });
    }
});

module.exports = router;