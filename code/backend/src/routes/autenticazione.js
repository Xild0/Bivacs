/**
 * @file autenticazione.js
 * @description Route Express per registrazione, login, verifica email,
 * recupero password e reinvio della mail di verifica.
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
 * Registra un nuovo utente registrato.
 *
 * @route POST /api/v1/auth/register
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

    const utenteEsistente = await Utente.findOne({ email });

    if (utenteEsistente) {
      return res.status(409).json({
        errore: 'Esiste già un account con questa mail'
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
      email,
      passwordHash: hashedPassword,
      dataNascita: new Date(dataNascita),
      emailToken: verificaToken,
      isVerified: false,
      discriminator: 'UtenteRegistrato'
    });

    await nuovoUtente.save();

    const linkVerifica = `http://localhost:5000/api/v1/auth/verify-email?token=${verificaToken}`;
    const htmlContent = `
      <h1>Benvenuto su Bivacs!</h1>
      <p>Ciao ${nome}, clicca sul pulsante qui sotto per confermare la tua email:</p>
      <a href="${linkVerifica}" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
        Conferma account
      </a>
    `;

    await inviaEmail(email, 'Benvenuto! Conferma la tua email', htmlContent);

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
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        errore: error.message
      });
    }

    res.status(500).json({
      errore: 'Errore interno del server'
    });
  }
});

/**
 * Effettua il login di un utente verificato.
 *
 * @route POST /api/v1/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        errore: 'Email e password obbligatorie'
      });
    }

    const utenteTrovato = await Utente.findOne({ email });

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

    const passwordCorretta = await bcrypt.compare(password, utenteTrovato.passwordHash);

    if (!passwordCorretta) {
      return res.status(401).json({
        errore: 'Credenziali non valide'
      });
    }

    const payload = {
      id: utenteTrovato.id,
      mongoId: utenteTrovato._id,
      discriminator: utenteTrovato.discriminator
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '2h'
    });

    res.status(200).json({
      messaggio: 'Login effettuato con successo',
      token
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore interno del server'
    });
  }
});

/**
 * Verifica l'indirizzo email tramite token ricevuto via mail.
 *
 * @route GET /api/v1/auth/verify-email
 */
router.get('/verify-email', async (req, res) => {
  try {
    const tokenSporco = req.query.token;

    if (!tokenSporco || typeof tokenSporco !== 'string') {
      return res.redirect('http://localhost:5173/?verificato=false&motivo=notoken');
    }

    const tokenUrl = tokenSporco.replace(/['"]/g, '');
    const utente = await UtenteRegistrato.findOne({ emailToken: tokenUrl });

    if (!utente) {
      return res.redirect('http://localhost:5173/?verificato=false');
    }

    utente.isVerified = true;
    utente.emailToken = undefined;

    await utente.save();

    return res.redirect('http://localhost:5173/?verificato=true');
  } catch (error) {
    return res.redirect('http://localhost:5173/?verificato=false&motivo=servererror');
  }
});

/**
 * Route di test per verificare la validità del token JWT.
 *
 * @route GET /api/v1/auth/profilo-test
 */
router.get('/profilo-test', protectRoute, (req, res) => {
  res.status(200).json({
    messaggio: 'Accesso consentito. Token valido.',
    datiUtenteToken: req.utente
  });
});

/**
 * Genera un token di recupero password e lo invia via email.
 *
 * @route POST /api/v1/auth/recupero_password
 */
router.post('/recupero_password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        errore: 'Email obbligatoria'
      });
    }

    const utente = await Utente.findOne({ email });

    if (!utente) {
      return res.status(404).json({
        errore: 'Email non trovata'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    utente.resetPassToken = resetToken;
    utente.resetPassExpires = Date.now() + 3600000;

    await utente.save();

    const linkReset = `http://localhost:5173/?reset=${resetToken}`;

    await inviaEmail(
      email,
      'Recupero Password Bivacs',
      `<p>Clicca sul seguente link per reimpostare la password:</p><a href="${linkReset}">${linkReset}</a>`
    );

    res.status(200).json({
      messaggio: 'Email di recupero inviata'
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore nel reset password'
    });
  }
});

/**
 * Imposta una nuova password usando il token ricevuto via email.
 *
 * @route POST /api/v1/auth/reset-password/:token
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
        errore: 'Token non valido o scaduto.'
      });
    }

    const saltRounds = 12;

    utente.passwordHash = await bcrypt.hash(nuovaPassword, saltRounds);
    utente.resetPassToken = undefined;
    utente.resetPassExpires = undefined;

    await utente.save();

    res.status(200).json({
      messaggio: 'Password aggiornata con successo. Ora puoi effettuare il login.'
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore interno del server'
    });
  }
});

/**
 * Reinvia la mail di verifica a un account non ancora confermato.
 *
 * @route POST /api/v1/auth/resend-verification
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        errore: 'Email obbligatoria'
      });
    }

    const utente = await Utente.findOne({ email });

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

    const linkVerifica = `http://localhost:5000/api/v1/auth/verify-email?token=${nuovoToken}`;

    await inviaEmail(
      email,
      'Conferma email Bivacs',
      `
        <h1>Conferma il tuo account Bivacs</h1>
        <p>Clicca sul pulsante per verificare la tua email:</p>
        <a href="${linkVerifica}" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
          Conferma account
        </a>
      `
    );

    res.status(200).json({
      messaggio: 'Email di verifica inviata nuovamente'
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore invio nuova email di verifica'
    });
  }
});

module.exports = router;