const express = require('express');
const router = express.Router();

const Percorso = require('../models/percorso');
const path = require('path');

// GET tutti i percorsi
router.get('/', async (req, res) => {
    try {
        const percorsi = await Percorso.find().populate('bivacco');

        res.status(200).json(percorsi);
    } catch (error) {
        res.status(500).json({
            message: 'Errore caricamento percorsi',
            error: error.message
        });
    }
});


// GET percorso per ID
router.get('/:id', async (req, res) => {
    try {
        const percorso = await Percorso.findById(req.params.id)
            .populate('bivacco');

        if (!percorso) {
            return res.status(404).json({
                message: 'Percorso non trovato'
            });
        }

        res.status(200).json(percorso);
    } catch (error) {
        res.status(500).json({
            message: 'Errore caricamento percorso',
            error: error.message
        });
    }
});


// POST nuovo percorso
router.post('/', async (req, res) => {
    try {
        const nuovoPercorso = new Percorso(req.body);

        const savedPercorso = await nuovoPercorso.save();

        res.status(201).json(savedPercorso);
    } catch (error) {
        res.status(400).json({
            message: 'Errore creazione percorso',
            error: error.message
        });
    }
});

/**
 * DOWNLOAD file GPX
 * GET /api/v1/percorsi/:id/download
 */
router.get('/:id/download', async (req, res) => {
    try {

        const percorso = await Percorso.findById(req.params.id);

        if (!percorso) {
            return res.status(404).json({
                message: 'Percorso non trovato'
            });
        }

        const filePath = path.join(
            __dirname,
            '../../uploads/gpx',
            percorso.gpxFile
        );

        res.download(filePath);

    } catch (error) {

        res.status(500).json({
            message: 'Errore download GPX',
            error: error.message
        });
    }
});

module.exports = router;