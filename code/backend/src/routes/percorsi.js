/**
 * @file percorsi.js
 * @description Route Express per la gestione dei percorsi associati ai bivacchi.
 * Espone endpoint per leggere, creare e scaricare percorsi GPX.
 */

const express = require('express');
const router = express.Router();

const Percorso = require('../models/percorso');
const path = require('path');

/**
 * Recupera tutti i percorsi presenti nel database.
 *
 * @route GET /api/v1/percorsi
 * @param {import('express').Request} req - Richiesta HTTP.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Lista dei percorsi con bivacco popolato.
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
 * @param {import('express').Request} req - Richiesta HTTP con parametro id.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Percorso richiesto oppure errore 404.
 */

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


/**
 * Crea un nuovo percorso associato a un bivacco.
 *
 * @route POST /api/v1/percorsi
 * @param {import('express').Request} req - Richiesta HTTP contenente i dati del percorso.
 * @param {import('express').Response} res - Risposta HTTP.
 * @returns {Promise<void>} Percorso creato oppure errore di validazione.
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
 * Scarica il file GPX associato a un percorso.
 *
 * @route GET /api/v1/percorsi/:id/download
 * @param {import('express').Request} req - Richiesta HTTP con id del percorso.
 * @param {import('express').Response} res - Risposta HTTP con download del file.
 * @returns {Promise<void>} File GPX oppure errore se il percorso non esiste.
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