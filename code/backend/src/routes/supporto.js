/**
 * @file supporto.js
 * @description Route Express riservate al Supporto Tecnico.
 * Gestisce log delle API esterne, configurazioni dei provider,
 * modifica dei dati tecnici dei bivacchi e richieste di promozione a Supporto Tecnico.
 */

const express = require('express');
const router = express.Router();

const LogAPI = require('../models/logAPI');
const ConfigAPI = require('../models/configAPI');
const Bivacco = require('../models/bivacco');
const Utente = require('../models/utente');

const { protectRoute } = require('../middlewares/authMiddleware');
const getNextSequence = require('../utils/getNewSequence');
const inviaEmail = require('../utils/emailService');

/**
 * Middleware di autorizzazione per le route del Supporto Tecnico.
 *
 * @param {import('express').Request} req - Richiesta HTTP con utente autenticato.
 * @param {import('express').Response} res - Risposta HTTP.
 * @param {import('express').NextFunction} next - Middleware successivo.
 * @returns {void}
 */
function isSupportoTecnico(req, res, next) {
  if (req.utente?.discriminator === 'SupportoTecnico') {
    return next();
  }

  return res.status(403).json({
    errore: 'Accesso negato. Solo il Supporto Tecnico può accedere.'
  });
}

/**
 * Estrae un messaggio leggibile da un errore sconosciuto.
 *
 * @param {unknown} err - Errore catturato.
 * @returns {string} Messaggio dell'errore.
 */
function getErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Recupera gli ultimi log delle chiamate alle API esterne.
 * US38 - Log API.
 *
 * @route GET /api/v1/supporto/log-api
 */
router.get('/log-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const logs = await LogAPI.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({
      message: 'Errore recupero log API',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera la lista delle configurazioni dei provider API esterni.
 * US39 - Configurazione API.
 *
 * @route GET /api/v1/supporto/config-api
 */
router.get('/config-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const configs = await ConfigAPI.find().sort({ provider: 1 });

    res.status(200).json(configs);
  } catch (err) {
    res.status(500).json({
      message: 'Errore recupero configurazioni API',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Crea una nuova configurazione per un provider API esterno.
 * US39 - Configurazione API.
 *
 * @route POST /api/v1/supporto/config-api
 */
router.post('/config-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { provider, baseUrl, enabled, timeoutMs } = req.body;

    if (!provider || !baseUrl) {
      return res.status(400).json({
        message: 'provider e baseUrl sono obbligatori'
      });
    }

    const esistente = await ConfigAPI.findOne({ provider });

    if (esistente) {
      return res.status(409).json({
        message: 'Esiste già una configurazione per questo provider'
      });
    }

    const id = await getNextSequence('configApiId');

    const nuovaConfig = await ConfigAPI.create({
      id,
      provider,
      baseUrl,
      enabled: enabled !== undefined ? enabled : true,
      timeoutMs: timeoutMs || 5000
    });

    res.status(201).json(nuovaConfig);
  } catch (err) {
    res.status(500).json({
      message: 'Errore creazione configurazione API',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Modifica una configurazione API esistente.
 * US39 - Configurazione API.
 *
 * @route PATCH /api/v1/supporto/config-api/:id
 */
router.patch('/config-api/:id', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { baseUrl, enabled, timeoutMs } = req.body;

    const aggiornamenti = {};

    if (baseUrl !== undefined) aggiornamenti.baseUrl = baseUrl;
    if (enabled !== undefined) aggiornamenti.enabled = enabled;
    if (timeoutMs !== undefined) aggiornamenti.timeoutMs = timeoutMs;

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno un campo da aggiornare'
      });
    }

    const configAggiornata = await ConfigAPI.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { new: true, runValidators: true }
    );

    if (!configAggiornata) {
      return res.status(404).json({
        message: 'Configurazione API non trovata'
      });
    }

    res.status(200).json({
      message: 'Configurazione API aggiornata con successo',
      config: configAggiornata
    });
  } catch (err) {
    res.status(500).json({
      message: 'Errore modifica configurazione API',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Modifica i dati tecnici di un bivacco esistente.
 * US40 - Modifica dati bivacco.
 *
 * @route PATCH /api/v1/supporto/bivacchi/:id
 */
router.patch('/bivacchi/:id', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      acquaPresente,
      legnaDisponibile,
      emergenza
    } = req.body;

    const aggiornamenti = {};

    if (nome !== undefined) aggiornamenti.nome = nome;
    if (latitudine !== undefined) aggiornamenti.latitudine = Number(latitudine);
    if (longitudine !== undefined) aggiornamenti.longitudine = Number(longitudine);
    if (altitudine !== undefined) aggiornamenti.altitudine = Number(altitudine);
    if (postiLetto !== undefined) aggiornamenti.postiLetto = Number(postiLetto);
    if (dotazioni !== undefined) aggiornamenti.dotazioni = dotazioni;
    if (zona !== undefined) aggiornamenti.zona = zona;
    if (tipoStruttura !== undefined) aggiornamenti.tipoStruttura = tipoStruttura;
    if (acquaPresente !== undefined) aggiornamenti.acquaPresente = acquaPresente;
    if (legnaDisponibile !== undefined) aggiornamenti.legnaDisponibile = legnaDisponibile;
    if (emergenza !== undefined) aggiornamenti.emergenza = emergenza;

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno un campo da aggiornare'
      });
    }

    const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { new: true, runValidators: true }
    );

    if (!bivaccoAggiornato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json({
      message: 'Bivacco aggiornato con successo',
      bivacco: bivaccoAggiornato
    });
  } catch (err) {
    res.status(500).json({
      message: 'Errore modifica bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Crea un nuovo bivacco dal pannello tecnico.
 * Estensione della US40.
 *
 * @route POST /api/v1/supporto/bivacchi
 */
router.post('/bivacchi', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      acquaPresente,
      legnaDisponibile,
      emergenza
    } = req.body;

    if (
      !nome ||
      latitudine === undefined ||
      longitudine === undefined ||
      altitudine === undefined ||
      !zona
    ) {
      return res.status(400).json({
        message: 'Campi obbligatori mancanti: nome, latitudine, longitudine, altitudine, zona'
      });
    }

    const id = await getNextSequence('bivaccoId');

    const nuovoBivacco = await Bivacco.create({
      id,
      nome,
      latitudine: Number(latitudine),
      longitudine: Number(longitudine),
      altitudine: Number(altitudine),
      postiLetto: Number(postiLetto) || 0,
      dotazioni: dotazioni || '',
      zona,
      tipoStruttura: tipoStruttura || 'fisso',
      emergenza: emergenza || false,
      acquaPresente: acquaPresente !== undefined ? acquaPresente : true,
      legnaDisponibile: legnaDisponibile !== undefined ? legnaDisponibile : true
    });

    res.status(201).json({
      message: 'Bivacco creato con successo',
      bivacco: nuovoBivacco
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Errore validazione',
        error: getErrorMessage(err)
      });
    }

    res.status(500).json({
      message: 'Errore creazione bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera le richieste di promozione a Supporto Tecnico ancora in attesa.
 *
 * @route GET /api/v1/supporto/richieste-supporto
 */
router.get('/richieste-supporto', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const richieste = await Utente.find({
      discriminator: 'UtenteRegistrato',
      'richiestaSupportoTecnico.stato': 'in_attesa'
    }).select('-passwordHash');

    res.status(200).json(richieste);
  } catch (err) {
    res.status(500).json({
      message: 'Errore recupero richieste supporto tecnico',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Approva una richiesta di promozione a Supporto Tecnico.
 * Aggiorna il discriminator dell'utente e invia una notifica email.
 *
 * @route PATCH /api/v1/supporto/richieste-supporto/:utenteId/approva
 */
router.patch('/richieste-supporto/:utenteId/approva', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.utenteId);

    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    const matricola =
      utente.richiestaSupportoTecnico?.matricolaRichiesta ||
      `ST-${utente.id}`;

    utente.discriminator = 'SupportoTecnico';
    utente.matricola = matricola;
    utente.richiestaSupportoTecnico.stato = 'approvata';

    await utente.save();

    const aggiornato = await Utente.findById(req.params.utenteId)
      .select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta Supporto Tecnico approvata',
      `
        <h2>Richiesta approvata</h2>
        <p>La tua richiesta per diventare Supporto Tecnico su Bivacs è stata approvata.</p>
        <p>Effettua nuovamente il login per accedere al pannello tecnico.</p>
      `
    );

    res.status(200).json({
      message: 'Utente promosso a Supporto Tecnico',
      utente: aggiornato
    });
  } catch (err) {
    res.status(500).json({
      message: 'Errore approvazione richiesta',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Rifiuta una richiesta di promozione a Supporto Tecnico.
 * Aggiorna lo stato della richiesta e invia una notifica email.
 *
 * @route PATCH /api/v1/supporto/richieste-supporto/:utenteId/rifiuta
 */
router.patch('/richieste-supporto/:utenteId/rifiuta', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { motivoRifiuto } = req.body;

    const utente = await Utente.findByIdAndUpdate(
      req.params.utenteId,
      {
        $set: {
          'richiestaSupportoTecnico.stato': 'rifiutata'
        }
      },
      { new: true }
    ).select('-passwordHash');

    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    await inviaEmail(
      utente.email,
      'Richiesta Supporto Tecnico rifiutata',
      `
        <h2>Richiesta rifiutata</h2>
        <p>La tua richiesta per diventare Supporto Tecnico su Bivacs è stata rifiutata.</p>
        <p>${motivoRifiuto || 'Non è stata indicata una motivazione specifica.'}</p>
      `
    );

    res.status(200).json({
      message: 'Richiesta rifiutata correttamente',
      utente
    });
  } catch (err) {
    res.status(500).json({
      message: 'Errore rifiuto richiesta',
      error: getErrorMessage(err)
    });
  }
});

module.exports = router;