const express = require('express');
const router = express.Router();

const Recensione = require('../models/recensione');
const Bivacco = require('../models/bivacco');

/**
 * POST /api/v1/recensioni
 * Inserisce una nuova recensione
 */
router.post('/', async (req, res) => {
  try {

    const { bivaccoId, utente, stelle, testo, anonima } = req.body;

    // Verifica esistenza bivacco
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
 * GET recensioni di un bivacco
 * /api/v1/recensioni/:bivaccoId
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