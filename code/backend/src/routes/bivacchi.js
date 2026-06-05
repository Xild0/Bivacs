/**
 * @file bivacchi.js
 * @description Route Express per la gestione dei bivacchi.
 * Espone endpoint per ricerca, dettaglio, creazione, eliminazione,
 * percorsi associati e aggiornamento collaborativo delle risorse.
 */

const express = require('express');
const router = express.Router();

const Bivacco = require('../models/bivacco');
const RisorseUtili = require('../models/risorseUtili');
const Percorso = require('../models/percorso');
const Segnalazione = require('../models/segnalazione');
const TicketManutenzione = require('../models/ticketManutenzione');
const { protectRoute } = require('../middlewares/authMiddleware');

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
 * Supporta ricerca per nome, zona, range di altitudine,
 * numero minimo di posti letto e tipo di struttura.
 *
 * @route GET /api/v1/bivacchi
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

    const filtri = {};

    if (nome) {
      filtri.nome = { $regex: nome, $options: 'i' };
    }

    if (zona) {
      filtri.zona = { $regex: zona, $options: 'i' };
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
      filtri.postiLetto = { $gte: Number(postiLetto) };
    }

    if (tipoStruttura) {
      filtri.tipoStruttura = tipoStruttura;
    }

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
 * Recupera la scheda dettagliata di un bivacco.
 * La risposta include:
 * - dati tecnici del bivacco;
 * - percorsi associati;
 * - numero di segnalazioni attive;
 * - ticket di manutenzione collegati;
 * - ultimo aggiornamento disponibile su acqua e legna.
 *
 * @route GET /api/v1/bivacchi/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.id).populate('percorsi');

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const segnalazioni = await Segnalazione.find({
      bivaccoId: bivacco._id
    });

    const segnalazioniIds = segnalazioni.map((segnalazione) => segnalazione._id);

    const ticketManutenzione = await TicketManutenzione.find({
      segnalazione: { $in: segnalazioniIds }
    })
      .populate('segnalazione', 'descrizione statoSegnalazione')
      .sort({ createdAt: -1 });

    const statiAttivi = ['inviata', 'presa_in_carico', 'in_corso'];

    const numeroSegnalazioniAttive = segnalazioni.filter((segnalazione) =>
      statiAttivi.includes(segnalazione.statoSegnalazione)
    ).length;

    const ultimeRisorse = await RisorseUtili.findOne({
      bivacco: bivacco._id
    })
      .sort({ createdAt: -1 })
      .populate('autore', 'email lingua');

    const bivaccoObj = bivacco.toObject();

    bivaccoObj.ticketAperti = numeroSegnalazioniAttive > 0;
    bivaccoObj.numeroTicketAperti = numeroSegnalazioniAttive;

    res.status(200).json({
      bivacco: bivaccoObj,
      ticketManutenzione,
      risorse: ultimeRisorse || {
        acqua: 'non_verificata',
        legna: 'non_verificata',
        messaggio: 'Nessun aggiornamento recente disponibile'
      }
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore nel recupero della scheda del bivacco',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Crea un nuovo bivacco nel database.
 * Valida i campi obbligatori e controlla che l'id numerico non sia già presente.
 *
 * @route POST /api/v1/bivacchi
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
      id,
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto: postiLetto || 0,
      dotazioni: dotazioni || '',
      zona,
      tipoStruttura: tipoStruttura || 'fisso',
      emergenza: emergenza || false,
      acquaPresente: acquaPresente !== undefined ? acquaPresente : true,
      legnaDisponibile: legnaDisponibile !== undefined ? legnaDisponibile : true
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
 */
router.get('/:id/percorsi', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.id);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const percorsi = await Percorso.find({
      bivacco: req.params.id
    });

    res.status(200).json(percorsi);
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore recupero percorsi',
      error: getErrorMessage(err)
    });
  }
});

/**
 * Aggiorna lo stato delle risorse utili di un bivacco.
 * Crea un record storico in RisorseUtili e sincronizza i campi booleani
 * acquaPresente e legnaDisponibile nel documento Bivacco.
 *
 * @route POST /api/v1/bivacchi/:id/risorse
 */
router.post('/:id/risorse', protectRoute, async (req, res) => {
  try {
    const { acqua, legna } = req.body;
    const bivaccoId = req.params.id;
    const utenteId = req.utente.mongoId;

    if (!acqua || !legna) {
      return res.status(400).json({
        message: 'I campi "acqua" e "legna" sono obbligatori.'
      });
    }

    const nuovaRisorsa = new RisorseUtili({
      id: Date.now(),
      bivacco: bivaccoId,
      autore: utenteId,
      acqua,
      legna
    });

    await nuovaRisorsa.save();

    const acquaPresente = acqua === 'disponibile' || acqua === 'scarsa';
    const legnaDisponibile = legna === 'disponibile' || legna === 'scarsa';

    const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
      bivaccoId,
      {
        $set: {
          acquaPresente,
          legnaDisponibile,
          ultimoCheckStato: Date.now()
        }
      },
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

    res.status(201).json({
      message: 'Stato risorse aggiornato con successo e salvato nella cronologia',
      risorse: nuovaRisorsa,
      bivacco: bivaccoAggiornato
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'CastError') {
      return res.status(400).json({
        message: 'ID bivacco non valido'
      });
    }

    res.status(500).json({
      message: 'Errore aggiornamento risorse',
      error: getErrorMessage(err)
    });
  }
});

module.exports = router;