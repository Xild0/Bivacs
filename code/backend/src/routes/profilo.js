/**
 * @file profilo.js
 * @description Route Express per la gestione del profilo utente.
 * Espone endpoint per visualizzare, aggiornare ed eliminare il profilo,
 * oltre alla gestione dei bivacchi preferiti.
 */

const mongoose = require('mongoose');
const express = require('express');
const bcrypt = require('bcryptjs');
const Utente = require('../models/utente');
const UtenteRegistrato = require('../models/utenteRegistrato');
const Recensione = require('../models/recensione');
const {protectRoute} = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Recupera i dati del profilo dell'utente attualmente loggato
 * * @route GET /api/v1/profilo
 * @param {import('express').Request} req - Richiesta HTTP
 * @param {import('express').Response} res - Risposta HTTP
 * @returns {Promise<void>} Ritorna i dati dell'utente escludendo la password
 */
router.get('/', protectRoute, async (req, res) => {
    try {
        const profilo = await UtenteRegistrato.findById(req.utente.mongoId)
            .select('-passwordHash')
            .populate('preferiti');

        if (!profilo) {
            const profiloBase = await Utente.findById(req.utente.mongoId)
                .select('-passwordHash');

            if (!profiloBase) {
                return res.status(404).json({ errore: 'Utente non trovato' });
            }

            return res.status(200).json(profiloBase);
        }

        res.status(200).json(profilo);
    } catch (error) {
        console.error('Errore nel recupero del profilo:', error);
        res.status(500).json({ errore: 'Errore interno del server' });
    }
});

/**
 * Aggiorna i dati dell'utente
 * * Permette di modificare nome, cognome, email e password. 
 * La nuova password viene automaticamente criptata prima del salvataggio.
 * * @route PATCH /api/v1/profilo
 * @param {import('express').Request} req - Richiesta HTTP (campi da aggiornare)
 * @param {import('express').Response} res - Risposta HTTP
 * @returns {Promise<void>} Ritorna il profilo aggiornato
 */
router.patch('/', protectRoute, async (req, res) => {
    try {
        const { nome, cognome, email, password } = req.body;
        
        // troviamo l'utente tramite l'ID del token
        let utente = await UtenteRegistrato.findById(req.utente.mongoId);
        if (!utente) {
            return res.status(404).json({ errore: 'Utente non trovato' });
        }

        // aggiorniamo solo i campi inviati nel body
        if (nome) utente.nome = nome;
        if (cognome) utente.cognome = cognome;
        if (email) {
            // controllo aggiuntivo se mail già presente nel database
            const emailEsistente = await Utente.findOne({ email: email, _id: { $ne: utente._id } });
            if (emailEsistente) {
                return res.status(409).json({ errore: 'Questa email è già in uso da un altro account' });
            }
            utente.email = email;
        }
        
        if (password) {
            const saltRounds = 12;
            utente.passwordHash = await bcrypt.hash(password, saltRounds);
        }

        // salvataggio delle modifiche
        const utenteAggiornato = await utente.save();

        res.status(200).json({ 
            messaggio: 'Profilo aggiornato con successo',
            utente: {
                id: utenteAggiornato.id,
                nome: utenteAggiornato.nome,
                cognome: utenteAggiornato.cognome,
                email: utenteAggiornato.email
            }
        });
    } catch (error) {
        console.error('Errore nell\'aggiornamento del profilo:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ errore: error.message });
        }
        res.status(500).json({ errore: 'Errore interno del server' });
    }
});

/**
 * Elimina permanentemente l'account dell'utente loggato.
 * Prima della cancellazione, anonimizza tutte le recensioni
 * dell'utente in conformità al "Diritto all'Oblio" (RF20, RNF12):
 * il contenuto e il rating restano visibili, ma il legame con
 * l'autore viene rimosso.
 *
 * @route DELETE /api/v1/profilo
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
router.delete('/', protectRoute, async (req, res) => {
    try {
        // Recupero dell'utente per ottenere il nome con cui sono state firmate le recensioni
        const utente = await UtenteRegistrato.findById(req.utente.mongoId);

        if (utente) {
            const nomeCompleto = `${utente.nome || ''} ${utente.cognome || ''}`.trim();

            // Anonimizzazione delle recensioni dell'utente
            if (nomeCompleto) {
                await Recensione.updateMany(
                    { utente: nomeCompleto },
                    { $set: { utente: 'Anonimo', anonima: true } }
                );
            }
        }

        const utenteEliminato = await Utente.findByIdAndDelete(req.utente.mongoId);

        if (!utenteEliminato) {
            return res.status(404).json({ errore: 'Utente non trovato o già eliminato' });
        }

        res.status(200).json({ messaggio: 'Account eliminato definitivamente' });
    } catch (error) {
        console.error('Errore durante l\'eliminazione dell\'account:', error);
        res.status(500).json({ errore: 'Errore interno del server' });
    }
});

/**
 * Aggiunge un bivacco ai preferiti dell'utente registrato
 * @route POST /api/v1/profilo/preferiti/:bivaccoId
 */
router.post('/preferiti/:bivaccoId', protectRoute, async (req, res) => {
    try {
        const { bivaccoId } = req.params;

        // Usiamo UtenteRegistrato perché il campo 'preferiti' è definito lì
        const utente = await UtenteRegistrato.findByIdAndUpdate(
            req.utente.mongoId,
            { $addToSet: { preferiti: bivaccoId } }, // $addToSet evita duplicati
            { new: true }
        );

        if (!utente) {
            return res.status(403).json({ errore: 'Solo gli utenti registrati possono avere preferiti' });
        }

        res.status(200).json({
            messaggio: 'Bivacco aggiunto ai preferiti',
            preferiti: utente.preferiti
        });
    } catch (error) {
        res.status(500).json({ errore: 'Errore nell\'aggiunta ai preferiti' });
    }
});

/**
 * Rimuove un bivacco dai preferiti
 * @route DELETE /api/v1/profilo/preferiti/:bivaccoId
 */
router.delete('/preferiti/:bivaccoId', protectRoute, async (req, res) => {
    try {
        const { bivaccoId } = req.params;

        const utente = await UtenteRegistrato.findByIdAndUpdate(
            req.utente.mongoId,
            { $pull: { preferiti: bivaccoId } }, // $pull rimuove l'ID dall'array
            { new: true }
        );

        res.status(200).json({
            messaggio: 'Bivacco rimosso dai preferiti',
            preferiti: utente.preferiti
        });
    } catch (error) {
        res.status(500).json({ errore: 'Errore nella rimozione dai preferiti' });
    }
});


module.exports = router;