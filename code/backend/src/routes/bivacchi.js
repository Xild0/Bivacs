/**
 * @file bivacchi.js
 * @description Route Express per la gestione dei bivacchi.
 * Espone endpoint per ricerca, dettaglio, creazione, eliminazione,
 * percorsi associati e aggiornamento dello stato delle risorse.
 */

const express = require('express');
const router = express.Router();

const Bivacco = require('../models/bivacco');
const Percorso = require('../models/percorso');
const Segnalazione = require('../models/segnalazione');
const {protectRoute} = require('../middlewares/authMiddleware');

/**
 * Estrae un messaggio leggibile da un errore sconosciuto.
 *
 * @param {unknown} err - Errore catturato nel blocco catch.
 * @returns {string} Messaggio dell'errore.
 */

const getErrorMessage = (err) =>
  err instanceof Error ? err.message : String(err);

/**
 * Recupera la lista dei bivacchi applicando eventuali filtri.
 * Supporta ricerca per nome, zona, range di altitudine e numero minimo di posti letto.
 *
 * @route GET /api/v1/bivacchi
 * @param {import('express').Request} req - Richiesta HTTP con query params opzionali.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista dei bivacchi filtrati.
 */

router.get('/', async (req, res) => {
  try {
    const {
      nome,
      zona,
      altitudineMin,
      altitudineMax,
      postiLetto,
      tipoStruttura
    } = req.query;

    /** @type {Record<string, any>} */
    const filtri = {};

    if (nome) {
      filtri.nome = {
        $regex: nome,
        $options: 'i'
      };
    }

    if (zona) {
      filtri.zona = {
        $regex: zona,
        $options: 'i'
      };
    }

    if (altitudineMin || altitudineMax) {
      filtri.altitudine = {};

      if (altitudineMin) {
        filtri.altitudine.$gte = Number(altitudineMin);
      }

      if (altitudineMax) {
        filtri.altitudine.$lte = Number(altitudineMax);
      }
    }

    if (postiLetto) {
      filtri.postiLetto = {
        $gte: Number(postiLetto)
      };
    }

    if (tipoStruttura) { filtri.tipoStruttura = tipoStruttura; }

    const bivacchi = await Bivacco.find(filtri);

    res.status(200).json(bivacchi);

  } catch (err) {
    res.status(500).json({
      message: 'Errore recupero bivacchi',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera la scheda dettagliata di un bivacco tramite ObjectId MongoDB.
 * Popola anche i percorsi associati al bivacco.
 *
 * @route GET /api/v1/bivacchi/:id
 * @param {import('express').Request} req - Richiesta HTTP con id del bivacco.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Bivacco richiesto oppure errore 400/404.
 */

router.get('/:id', async (req, res) => {
  try {

  const bivacco = await Bivacco.findById(req.params.id)
    .populate('percorsi');

  if (!bivacco) {
    return res.status(404).json({
      message: 'Bivacco non trovato'
    });
  }

  const segnalazioniAttive = await Segnalazione.countDocuments({
    bivaccoId: bivacco._id,
    statoSegnalazione: {
      $in: ['inviata', 'presa_in_carico', 'in_corso']
    }
  });

  const bivaccoObj = bivacco.toObject();

  bivaccoObj.ticketAperti = segnalazioniAttive > 0;
  bivaccoObj.numeroTicketAperti = segnalazioniAttive;

  res.status(200).json(bivaccoObj);

  } catch (err) {

    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore recupero bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Crea un nuovo bivacco nel database.
 * Valida i campi obbligatori e controlla che l'id numerico non sia già presente.
 *
 * @route POST /api/v1/bivacchi
 * @param {import('express').Request} req - Richiesta HTTP contenente i dati del bivacco.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Bivacco creato oppure errore di validazione.
 */

router.post('/', async (req, res) => {
  try {

    const {
      id,
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      emergenza,
      acquaPresente,
      legnaDisponibile
    } = req.body;

    if (
      id === undefined ||
      !nome ||
      latitudine === undefined ||
      longitudine === undefined ||
      altitudine === undefined ||
      !zona
    ) {
      return res.status(400).json({
        message: 'Campi obbligatori mancanti'
      });
    }

    const bivaccoEsistente = await Bivacco.findOne({ id });

    if (bivaccoEsistente) {
      return res.status(409).json({
        message: 'Esiste già un bivacco con questo id'
      });
    }

    const nuovoBivacco = new Bivacco({
      id: id,
      nome: nome,
      latitudine: latitudine,
      longitudine: longitudine,
      altitudine: altitudine,
      postiLetto: postiLetto || 0,
      dotazioni: dotazioni || '',
      zona: zona,
      tipoStruttura: tipoStruttura || 'fisso',
      emergenza: emergenza || false,
      acquaPresente:
        acquaPresente !== undefined
          ? acquaPresente
          : true,
      legnaDisponibile:
        legnaDisponibile !== undefined
          ? legnaDisponibile
          : true
    });

    const bivaccoSalvato = await nuovoBivacco.save();

    res.status(201).json(bivaccoSalvato);

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
 * Elimina un bivacco tramite ObjectId MongoDB.
 *
 * @route DELETE /api/v1/bivacchi/:id
 * @param {import('express').Request} req - Richiesta HTTP con id del bivacco.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Messaggio di conferma oppure errore 400/404.
 */

router.delete('/:id', async (req, res) => {
  try {

    const bivaccoEliminato = await Bivacco.findByIdAndDelete(req.params.id);

    if (!bivaccoEliminato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json({
      message: 'Bivacco eliminato correttamente'
    });

  } catch (err) {

    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore eliminazione bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Recupera tutti i percorsi associati a un bivacco.
 * Prima verifica che il bivacco esista, poi restituisce i percorsi collegati.
 *
 * @route GET /api/v1/bivacchi/:id/percorsi
 * @param {import('express').Request} req - Richiesta HTTP con id del bivacco.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista dei percorsi associati al bivacco.
 */

router.get('/:id/percorsi', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.id)

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      })
    }

    const percorsi = await Percorso.find({
      bivacco: req.params.id
    })

    res.status(200).json(percorsi)

  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      })
    }

    res.status(500).json({
      message: 'Errore recupero percorsi',
      error: getErrorMessage(err)
    })
  }
})

/**
 * Aggiorna lo stato delle risorse disponibili per un bivacco.
 * Permette di modificare acquaPresente e/o legnaDisponibile.
 * Richiede autenticazione tramite token JWT.
 *
 * @route PATCH /api/v1/bivacchi/:id/risorse
 * @param {import('express').Request} req - Richiesta HTTP con campi acquaPresente e/o legnaDisponibile.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Bivacco aggiornato oppure errore.
 */

router.patch('/:id/risorse', protectRoute, async (req, res) => {
  try {
    const { acquaPresente, legnaDisponibile } = req.body;

    const aggiornamenti = {};
    
    if (acquaPresente !== undefined) {
        aggiornamenti.acquaPresente = acquaPresente;
    }
    
    if (legnaDisponibile !== undefined) {
        aggiornamenti.legnaDisponibile = legnaDisponibile;
    }

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno uno tra acquaPresente o legnaDisponibile'
      });
    }

    aggiornamenti.ultimoCheckStato = Date.now();

    const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { 
        new: true,           
        runValidators: true 
      }
    );

    if (!bivaccoAggiornato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json({
      message: 'Stato risorse aggiornato con successo',
      bivacco: bivaccoAggiornato
    });

  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({ message: 'ID bivacco non valido' });
    }

    res.status(500).json({
      message: 'Errore aggiornamento risorse',
      error: getErrorMessage(err)
    });
  }
});

module.exports = router;