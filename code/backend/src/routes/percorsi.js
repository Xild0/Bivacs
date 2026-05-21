/**
 * @file percorsi.js
 * @description Route Express per la gestione dei percorsi associati ai bivacchi.
 * Espone endpoint per leggere, creare, servire e scaricare percorsi GPX.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const Percorso = require('../models/percorso');
const { protectRoute } = require('../middlewares/authMiddleware');

const GPX_DIR = path.join(__dirname, '../../uploads/gpx');

/**
 * Recupera tutti i percorsi presenti nel database.
 *
 * @route GET /api/v1/percorsi
 */
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

/**
 * Recupera un percorso specifico tramite ObjectId MongoDB.
 *
 * @route GET /api/v1/percorsi/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const percorso = await Percorso.findById(req.params.id)
            .populate('bivacco');

        if (!percorso) {
            return res.status(404).json({ message: 'Percorso non trovato' });
        }

        res.status(200).json(percorso);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID percorso non valido' });
        }
        res.status(500).json({
            message: 'Errore caricamento percorso',
            error: error.message
        });
    }
});

/**
 * Crea un nuovo percorso associato a un bivacco.
 *
 * @route POST /api/v1/percorsi
 */
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
 * Serve il file GPX di un percorso per la visualizzazione del tracciato sulla mappa (US14).
 * Endpoint pubblico: non richiede autenticazione.
 *
 * @route GET /api/v1/percorsi/:id/gpx
 */
router.get('/:id/gpx', async (req, res) => {
    try {
        const percorso = await Percorso.findById(req.params.id);

        if (!percorso) {
            return res.status(404).json({ message: 'Percorso non trovato' });
        }

        if (!percorso.gpxFile) {
            return res.status(404).json({ message: 'Nessun file GPX associato a questo percorso' });
        }

        const filePath = path.join(GPX_DIR, percorso.gpxFile);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File GPX non trovato sul server' });
        }

        res.type('application/gpx+xml');
        res.sendFile(filePath);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID percorso non valido' });
        }
        res.status(500).json({
            message: 'Errore caricamento GPX',
            error: error.message
        });
    }
});

/**
 * Scarica il file GPX di un percorso per la navigazione offline (US16, RF19).
 * Endpoint riservato a utenti autenticati.
 *
 * @route GET /api/v1/percorsi/:id/download
 */
router.get('/:id/download', protectRoute, async (req, res) => {
    try {
        const percorso = await Percorso.findById(req.params.id).populate('bivacco');

        if (!percorso) {
            return res.status(404).json({ message: 'Percorso non trovato' });
        }

        if (!percorso.gpxFile) {
            return res.status(404).json({ message: 'Nessun file GPX associato a questo percorso' });
        }

        const filePath = path.join(GPX_DIR, percorso.gpxFile);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File GPX non trovato sul server' });
        }

        const nomeBivacco = percorso.bivacco?.nome
            ? percorso.bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
            : 'percorso';
        const downloadName = `${nomeBivacco}.gpx`;

        res.download(filePath, downloadName);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID percorso non valido' });
        }
        res.status(500).json({
            message: 'Errore download GPX',
            error: error.message
        });
    }
});

module.exports = router;