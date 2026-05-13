const express = require('express');
const router = express.Router();

const Bivacco = require('../models/bivacco');

/** @param {unknown} err */
const getErrorMessage = (err) =>
  err instanceof Error ? err.message : String(err);

/**
 * GET tutti i bivacchi con filtri
 * /api/v1/bivacchi?nome=care&zona=Adamello&altitudineMin=2000
 */
router.get('/', async (req, res) => {
  try {
    const {
      nome,
      zona,
      altitudineMin,
      altitudineMax,
      postiLetto
    } = req.query;

    /** @type {Record<string, any>} */
    const filtri = {};

    // Ricerca nome case-insensitive
    if (nome) {
      filtri.nome = {
        $regex: nome,
        $options: 'i'
      };
    }

    // Filtro zona
    if (zona) {
      filtri.zona = {
        $regex: zona,
        $options: 'i'
      };
    }

    // Filtro altitudine
    if (altitudineMin || altitudineMax) {
      filtri.altitudine = {};

      if (altitudineMin) {
        filtri.altitudine.$gte = Number(altitudineMin);
      }

      if (altitudineMax) {
        filtri.altitudine.$lte = Number(altitudineMax);
      }
    }

    // Filtro posti letto
    if (postiLetto) {
      filtri.postiLetto = {
        $gte: Number(postiLetto)
      };
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
 * GET bivacco per ID Mongo
 */
router.get('/:id', async (req, res) => {
  try {

    const bivacco = await Bivacco
      .findById(req.params.id)
      .populate('percorsi');

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json(bivacco);

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
 * POST nuovo bivacco
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
      emergenza,
      acquaPresente,
      legnaDisponibile
    } = req.body;

    // Controllo campi obbligatori
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

    // Controllo ID duplicato
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
 * DELETE bivacco
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

module.exports = router;