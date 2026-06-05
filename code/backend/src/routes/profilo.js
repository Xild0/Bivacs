/**
 * @file profilo.js
 * @description Route Express per la gestione del profilo utente.
 * Espone endpoint per visualizzare, aggiornare ed eliminare il profilo,
 * gestire i bivacchi preferiti e inviare richieste di promozione a Supporto Tecnico.
 */

const express = require('express');
const bcrypt = require('bcryptjs');

const Utente = require('../models/utente');
const UtenteRegistrato = require('../models/utenteRegistrato');
const Recensione = require('../models/recensione');
const { protectRoute } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Recupera i dati del profilo dell'utente autenticato.
 * Se l'utente è un UtenteRegistrato, popola anche la lista dei preferiti.
 * Per ruoli diversi restituisce il profilo base senza password.
 *
 * @route GET /api/v1/profilo
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
        return res.status(404).json({
          errore: 'Utente non trovato'
        });
      }

      return res.status(200).json(profiloBase);
    }

    res.status(200).json(profilo);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore interno del server'
    });
  }
});

/**
 * Aggiorna i dati modificabili del profilo utente.
 * Permette di modificare nome, cognome, email e password.
 *
 * @route PATCH /api/v1/profilo
 */
router.patch('/', protectRoute, async (req, res) => {
  try {
    const { nome, cognome, email, password } = req.body;

    const utente = await UtenteRegistrato.findById(req.utente.mongoId);

    if (!utente) {
      return res.status(404).json({
        errore: 'Utente non trovato'
      });
    }

    if (nome) utente.nome = nome;
    if (cognome) utente.cognome = cognome;

    if (email) {
      const emailEsistente = await Utente.findOne({
        email,
        _id: { $ne: utente._id }
      });

      if (emailEsistente) {
        return res.status(409).json({
          errore: 'Questa email è già in uso da un altro account'
        });
      }

      utente.email = email;
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          errore: 'La password deve contenere almeno 8 caratteri'
        });
      }

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
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        errore: error.message
      });
    }

    res.status(500).json({
      errore: 'Errore interno del server'
    });
  }
});

/**
 * Elimina permanentemente l'account dell'utente autenticato.
 * Prima della cancellazione anonimizza le recensioni firmate con il nome dell'utente.
 *
 * @route DELETE /api/v1/profilo
 */
router.delete('/', protectRoute, async (req, res) => {
  try {
    const utente = await UtenteRegistrato.findById(req.utente.mongoId);

    if (utente) {
      const nomeCompleto = `${utente.nome || ''} ${utente.cognome || ''}`.trim();

      if (nomeCompleto) {
        await Recensione.updateMany(
          { utente: nomeCompleto },
          {
            $set: {
              utente: 'Anonimo',
              anonima: true
            }
          }
        );
      }
    }

    const utenteEliminato = await Utente.findByIdAndDelete(req.utente.mongoId);

    if (!utenteEliminato) {
      return res.status(404).json({
        errore: 'Utente non trovato o già eliminato'
      });
    }

    res.status(200).json({
      messaggio: 'Account eliminato definitivamente'
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore interno del server'
    });
  }
});

/**
 * Aggiunge un bivacco alla lista dei preferiti dell'utente registrato.
 *
 * @route POST /api/v1/profilo/preferiti/:bivaccoId
 */
router.post('/preferiti/:bivaccoId', protectRoute, async (req, res) => {
  try {
    const { bivaccoId } = req.params;

    const utente = await UtenteRegistrato.findByIdAndUpdate(
      req.utente.mongoId,
      { $addToSet: { preferiti: bivaccoId } },
      { new: true }
    );

    if (!utente) {
      return res.status(403).json({
        errore: 'Solo gli utenti registrati possono avere preferiti'
      });
    }

    res.status(200).json({
      messaggio: 'Bivacco aggiunto ai preferiti',
      preferiti: utente.preferiti
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore nell\'aggiunta ai preferiti'
    });
  }
});

/**
 * Rimuove un bivacco dalla lista dei preferiti dell'utente registrato.
 *
 * @route DELETE /api/v1/profilo/preferiti/:bivaccoId
 */
router.delete('/preferiti/:bivaccoId', protectRoute, async (req, res) => {
  try {
    const { bivaccoId } = req.params;

    const utente = await UtenteRegistrato.findByIdAndUpdate(
      req.utente.mongoId,
      { $pull: { preferiti: bivaccoId } },
      { new: true }
    );

    if (!utente) {
      return res.status(403).json({
        errore: 'Solo gli utenti registrati possono avere preferiti'
      });
    }

    res.status(200).json({
      messaggio: 'Bivacco rimosso dai preferiti',
      preferiti: utente.preferiti
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore nella rimozione dai preferiti'
    });
  }
});

/**
 * Invia una richiesta di promozione al ruolo di Supporto Tecnico.
 * La richiesta resta in attesa finché un Supporto Tecnico autorizzato non la approva o rifiuta.
 *
 * @route POST /api/v1/profilo/richiesta-supporto-tecnico
 */
router.post('/richiesta-supporto-tecnico', protectRoute, async (req, res) => {
  try {
    const { motivo, matricola } = req.body;

    const utente = await UtenteRegistrato.findById(req.utente.mongoId);

    if (!utente) {
      return res.status(404).json({
        errore: 'Utente registrato non trovato'
      });
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
    res.status(500).json({
      errore: 'Errore invio richiesta supporto tecnico'
    });
  }
});

module.exports = router;