// @ts-nocheck
const express = require('express');
const router = express.Router();
const Bivacco = require('../models/bivacco');
const Percorso = require('../models/percorso');

/*
    GET /api/v1/bivacchi
    Restituisce la lista dei bivacchi con filtri opzionali.
 
 */
router.get('/', async (req, res) => {
    try {
        // estrazione dei parametri dalla query string
        const { nome, zona, altitudineMin, altitudineMax, postiLetto } = req.query;

        // oggetto filtro: viene popolato solo con i parametri presenti nella richiesta
        const filtro = {};

        // US07 — ricerca per nome (case-insensitive)

        if (nome) {
            filtro.nome = { $regex: nome, $options: 'i' };
        }

        // US09 — filtro per zona geografica (case-insensitive)
        if (zona) {
            filtro.zona = { $regex: zona, $options: 'i' };
        }

        // US08 — filtro per range di altitudine
        if (altitudineMin || altitudineMax) {
            filtro.altitudine = {};
            if (altitudineMin) filtro.altitudine.$gte = Number(altitudineMin);
            if (altitudineMax) filtro.altitudine.$lte = Number(altitudineMax);
        }

        // US10 — filtro per posti letto minimi disponibili
        if (postiLetto) {
            filtro.postiLetto = { $gte: Number(postiLetto) };
        }

        // esecuzione query con il filtro costruito
        // .select() limita i campi restituiti (performance)
        const bivacchi = await Bivacco.find(filtro).select(
            'nome latitudine longitudine altitudine postiLetto zona dotazioni emergenza acquaPresente legnaDisponibile ultimoCheckStato'
        );

        res.status(200).json(bivacchi);

    } catch (err) {
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

/*
    GET /api/v1/bivacchi/:id
    Restituisce la scheda completa di un singolo bivacco.
 
    Il campo emergenza (true/false) indica se è attivo un alert sul bivacco — corrisponde a RF37 del D1.
*/

router.get('/:id', async (req, res) => {
    try {
        const bivacco = await Bivacco.findById(req.params.id).populate('percorsi');

        if (!bivacco) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        res.status(200).json(bivacco);

    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID bivacco non valido' });
        }
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

/*
    GET /api/v1/bivacchi/:id/percorsi
    Restituisce tutti i percorsi associati a un bivacco.
 */

router.get('/:id/percorsi', async (req, res) => {
    try {
        // prima verifica che il bivacco esista
        const bivacco = await Bivacco.findById(req.params.id);
        if (!bivacco) {
            return res.status(404).json({ message: 'Bivacco non trovato' });
        }

        // recupera tutti i percorsi che hanno questo bivacco come riferimento
        const percorsi = await Percorso.find({ bivacco: req.params.id });

        res.status(200).json(percorsi);

    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'ID bivacco non valido' });
        }
        res.status(500).json({
            message: 'Errore interno del server',
            error: err.message
        });
    }
});

module.exports = router;