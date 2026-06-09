/**
 * @file profilo.js
 * @description API REST per la gestione del profilo utente.
 *
 * Include:
 * - visualizzazione del profilo;
 * - aggiornamento dei dati personali;
 * - eliminazione dell'account;
 * - gestione dei bivacchi preferiti;
 * - richiesta di promozione a Supporto Tecnico;
 * - richiesta di promozione a SuperUser.
 */

const mongoose = require('mongoose');
const express = require('express');
const bcrypt = require('bcryptjs');
const Utente = require('../models/utente');
const UtenteRegistrato = require('../models/utenteRegistrato');
const Recensione = require('../models/recensione');
const Bivacco = require('../models/bivacco');
const {protectRoute} = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Recupera i dati del profilo dell'utente autenticato.
 *
 * L'operazione:
 * - recupera l'utente tramite id presente nel token;
 * - esclude l'hash della password;
 * - include i bivacchi preferiti se presenti.
 *
 * @route GET /api/v1/profilo
 * @access Private
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
 * Aggiorna i dati del profilo dell'utente autenticato.
 *
 * L'operazione:
 * - modifica solo i campi inviati nel body;
 * - controlla che la nuova email non sia già in uso;
 * - cripta la nuova password se presente;
 * - salva le modifiche nel database.
 *
 * @route PATCH /api/v1/profilo
 * @access Private
 */
router.patch('/', protectRoute, async (req, res) => {
    try {
        const { nome, cognome, email, password } = req.body;
        
        let utente = await UtenteRegistrato.findById(req.utente.mongoId);
        if (!utente) {
            return res.status(404).json({ errore: 'Utente non trovato' });
        }

        if (nome) utente.nome = nome;
        if (cognome) utente.cognome = cognome;
        if (email) {
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
 * Elimina permanentemente l'account dell'utente autenticato.
 *
 * L'operazione:
 * - anonimizza le recensioni dell'utente;
 * - rimuove il collegamento tra recensioni e autore;
 * - elimina l'account dal database.
 *
 * Il contenuto delle recensioni resta visibile
 * in conformità al diritto all'oblio.
 *
 * @route DELETE /api/v1/profilo
 * @access Private
 */
router.delete('/', protectRoute, async (req, res) => {
    try {
        const utente = await UtenteRegistrato.findById(req.utente.mongoId);

        if (utente) {
            await Recensione.updateMany(
                { utente: req.utente.mongoId },
                {
                    $set: {
                        nomeVisualizzato: 'Anonimo',
                        anonima: true,
                        utente: null
                    }
                }
            );
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
 * Aggiunge un bivacco ai preferiti dell'utente.
 *
 * L'operazione:
 * - valida l'id del bivacco;
 * - verifica che il bivacco esista;
 * - controlla che l'utente possa gestire i preferiti;
 * - aggiunge il bivacco alla lista dei preferiti.
 *
 * @route POST /api/v1/profilo/preferiti/:bivaccoId
 * @access Private
 */
router.post('/preferiti/:bivaccoId', protectRoute, async (req, res) => {
    try {
        const { bivaccoId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(bivaccoId)) {
            return res.status(400).json({ errore: 'ID bivacco non valido' });
        }

        const bivacco = await Bivacco.findById(bivaccoId);
        if (!bivacco) {
            return res.status(404).json({ errore: 'Bivacco non trovato' });
        }

        const utenteBase = await Utente.findById(req.utente.mongoId);

        if (!utenteBase) {
            return res.status(404).json({ errore: 'Utente non trovato' });
        }

        if (utenteBase.discriminator !== 'UtenteRegistrato') {
            return res.status(403).json({
                errore: 'Solo gli utenti registrati standard possono gestire i preferiti'
            });
        }

        const utente = await UtenteRegistrato.findByIdAndUpdate(
            req.utente.mongoId,
            { $addToSet: { preferiti: bivaccoId } },
            { new: true, runValidators: true }
        ).populate('preferiti');

        res.status(200).json({
            messaggio: 'Bivacco aggiunto ai preferiti',
            preferiti: utente.preferiti
        });
    } catch (error) {
        console.error('Errore aggiunta preferito:', error);
        res.status(500).json({ errore: 'Errore nell’aggiunta ai preferiti' });
    }
});

/**
 * Rimuove un bivacco dai preferiti dell'utente.
 *
 * L'operazione:
 * - valida l'id del bivacco;
 * - controlla che l'utente possa gestire i preferiti;
 * - rimuove il bivacco dalla lista dei preferiti aggiornata.
 *
 * @route DELETE /api/v1/profilo/preferiti/:bivaccoId
 * @access Private
 */
router.delete('/preferiti/:bivaccoId', protectRoute, async (req, res) => {
    try {
        const { bivaccoId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(bivaccoId)) {
            return res.status(400).json({ errore: 'ID bivacco non valido' });
        }

        const utenteBase = await Utente.findById(req.utente.mongoId);

        if (!utenteBase) {
            return res.status(404).json({ errore: 'Utente non trovato' });
        }

        if (utenteBase.discriminator !== 'UtenteRegistrato') {
            return res.status(403).json({
                errore: 'Solo gli utenti registrati standard possono gestire i preferiti'
            });
        }

        const utente = await UtenteRegistrato.findByIdAndUpdate(
            req.utente.mongoId,
            { $pull: { preferiti: bivaccoId } },
            { new: true, runValidators: true }
        ).populate('preferiti');

        res.status(200).json({
            messaggio: 'Bivacco rimosso dai preferiti',
            preferiti: utente.preferiti
        });
    } catch (error) {
        console.error('Errore rimozione preferito:', error);
        res.status(500).json({ errore: 'Errore nella rimozione dai preferiti' });
    }
});

/**
 * Invia una richiesta di promozione a Supporto Tecnico.
 *
 * L'operazione:
 * - recupera l'utente autenticato;
 * - verifica che non abbia già il ruolo richiesto;
 * - salva motivo e matricola della richiesta;
 * - imposta lo stato della richiesta come in attesa.
 *
 * @route POST /api/v1/profilo/richiesta-supporto-tecnico
 * @access Private
 */
router.post('/richiesta-supporto-tecnico', protectRoute, async (req, res) => {
    try {
        const { motivo, matricola } = req.body;

        const utente = await UtenteRegistrato.findById(req.utente.mongoId);

        if (!utente) {
            return res.status(404).json({ errore: 'Utente registrato non trovato' });
        }

        if(utente.discriminator == 'SupportoTecnico'){
            return res.status(400).json({message: 'Possiedi già questo ruolo'})
        }

        utente.richiestaSupportoTecnico = {
            stato: 'in_attesa',
            motivo: motivo || '',
            matricolaRichiesta: matricola || ''
        };

        await utente.save();

        res.status(200).json({
            messaggio: 'Richiesta inviata. Attendi approvazione.'
        });
    } catch (error) {
        res.status(500).json({ errore: 'Errore invio richiesta supporto tecnico' });
    }
});

/**
 * Invia una richiesta di promozione a SuperUser.
 *
 * L'operazione:
 * - recupera l'utente autenticato;
 * - verifica che non abbia già il ruolo richiesto;
 * - salva il motivo della richiesta;
 * - imposta lo stato della richiesta come in attesa.
 *
 * @route POST /api/v1/profilo/richiesta-superuser
 * @access Private
 */
router.post('/richiesta-superuser', protectRoute, async (req, res) => {
  try {
    const {motivo} = req.body;
    const utente = await UtenteRegistrato.findById(req.utente.mongoId);
    if (!utente) {
      return res.status(404).json({message: 'Utente non trovato'});
    }

    if (utente.discriminator === 'SuperUser') {                                           
      return res.status(400).json({message: 'Possiedi già questo ruolo'});
    }

    utente.richiestaSuperUser={
        stato: 'in_attesa', 
        motivo: motivo || ''
    };

    await utente.save();

    res.status(200).json({message: 'Richiesta inviata, attendi approvazione', utente});
  } catch (error) {
    console.error('Errore durante la richiesta Super User:', error);
    res.status(500).json({message: 'Errore interno del server'});
  }
});


module.exports = router;