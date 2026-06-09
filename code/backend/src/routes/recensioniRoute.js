/**
 * @file recensioniRoute.js
 * @description API REST per la gestione delle recensioni dei bivacchi.
 *
 * Include:
 * - creazione di recensioni;
 * - gestione delle recensioni anonime;
 * - recupero delle recensioni associate a un bivacco.
 */

const express = require('express');
const router = express.Router();

const Recensione = require('../models/recensione');
const Bivacco = require('../models/bivacco');
const { protectRoute } = require('../middlewares/authMiddleware');

/**
 * Crea una nuova recensione per un bivacco.
 *
 * L'operazione:
 * - verifica che il bivacco esista;
 * - recupera l'utente autenticato;
 * - imposta il nome visualizzato;
 * - salva la recensione nel database.
 *
 * Se la recensione è anonima, il nome visualizzato
 * viene impostato ad "Anonimo".
 *
 * @route POST /api/v1/recensioni
 * @access Private
 */

router.post('/', protectRoute, async (req, res) => {
  try {
    const { bivaccoId, stelle, testo, anonima } = req.body;

    const bivacco = await Bivacco.findById(bivaccoId);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const Utente = require('../models/utente');
    const utenteAutenticato = await Utente.findById(req.utente.mongoId);

    if (!utenteAutenticato) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    const nomeVisualizzato = anonima
      ? 'Anonimo'
      : `${utenteAutenticato.nome || ''} ${utenteAutenticato.cognome || ''}`.trim()
        || utenteAutenticato.email
        || 'Escursionista';

    const nuovaRecensione = new Recensione({
      bivaccoId,
      utente: req.utente.mongoId,
      nomeVisualizzato,
      stelle,
      testo,
      anonima: anonima || false
    });

    const recensioneSalvata = await nuovaRecensione.save();

    res.status(201).json(recensioneSalvata);
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : String(err);

    res.status(400).json({
      message: 'Errore creazione recensione',
      error: errorMessage
    });
  }
});

/**
 * Recupera tutte le recensioni associate a un bivacco.
 *
 * L'operazione:
 * - cerca le recensioni tramite id del bivacco;
 * - include alcune informazioni dell'utente autore;
 * - ordina i risultati dalla recensione più recente.
 *
 * @route GET /api/v1/recensioni/:bivaccoId
 * @access Public
 */

router.get('/:bivaccoId', async (req, res) => {
  try {
    const recensioni = await Recensione
      .find({ bivaccoId: req.params.bivaccoId })
      .populate('utente', 'email discriminator')
      .sort({ createdAt: -1 });

    res.status(200).json(recensioni);
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : String(err);

    res.status(400).json({
      message: 'Errore recupero recensioni',
      error: errorMessage
    });
  }
});

module.exports = router;