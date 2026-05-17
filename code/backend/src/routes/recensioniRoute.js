/**
 * @file recensioniRoute.js
 * @description Route Express per la gestione delle recensioni dei bivacchi.
 * Permette di creare recensioni e recuperare quelle associate a un bivacco.
 */

const express = require('express');
const router = express.Router();

const Recensione = require('../models/recensione');
const Bivacco = require('../models/bivacco');

/**
 * Crea una nuova recensione per un bivacco.
 * Se la recensione è anonima, il nome visualizzato viene impostato ad "Anonimo".
 *
 * @route POST /api/v1/recensioni
 * @param {import('express').Request} req - Richiesta HTTP con bivaccoId, utente, stelle, testo e anonima.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Recensione salvata oppure errore di validazione.
 */

router.post('/', async (req, res) => {
  try {

    const { bivaccoId, utente, stelle, testo, anonima } = req.body;

    const bivacco = await Bivacco.findById(bivaccoId);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const nuovaRecensione = new Recensione({
      bivaccoId,
      utente: anonima
        ? 'Anonimo'
        : (utente || 'Escursionista'),
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
 * @route GET /api/v1/recensioni/:bivaccoId
 * @param {import('express').Request} req - Richiesta HTTP con parametro bivaccoId.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista recensioni ordinate dalla più recente.
 */

router.get('/:bivaccoId', async (req, res) => {
  try {

    const recensioni = await Recensione
      .find({ bivaccoId: req.params.bivaccoId })
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