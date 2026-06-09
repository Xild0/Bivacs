/**
 * @file segnalazioniRoute.js
 * @description API REST per la gestione delle segnalazioni degli utenti.
 *
 * Include:
 * - creazione di segnalazioni con foto;
 * - consultazione delle segnalazioni attive;
 * - storico completo delle segnalazioni;
 * - segnalazioni associate a un bivacco;
 * - aggiornamento dello stato delle segnalazioni;
 * - storico personale delle segnalazioni inviate.
 */

const express = require('express');

const router = express.Router();

const Segnalazione = require('../models/segnalazione');
const Immagine = require('../models/immagine');
const Utente = require('../models/utente');

const upload = require('../config/multer');
const { protectRoute, isStaff } = require('../middlewares/authMiddleware');
const inviaEmail = require('../utils/emailService');
const getNextSequence = require('../utils/getNewSequence');

/**
 * Crea una nuova segnalazione per un bivacco.
 *
 * L'operazione:
 * - richiede una foto allegata;
 * - collega la segnalazione all'utente autenticato;
 * - salva l'immagine associata;
 * - invia una email di conferma all'utente;
 * - restituisce la segnalazione completa.
 *
 * @route POST /api/v1/segnalazioni
 * @access Private
 */
router.post('/', protectRoute, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        errore: 'La foto della segnalazione è obbligatoria'
      });
    }

    const pathFoto = `/uploads/segnalazioni/${req.file.filename}`;

    const nuovaSegnalazione = new Segnalazione({
      utenteId: req.utente.mongoId,
      bivaccoId: req.body.bivaccoId,
      descrizione: req.body.descrizione,
      foto: pathFoto
    });

    const reportSalvato = await nuovaSegnalazione.save();

    const idImmagine = await getNextSequence('immagineId');

    const immagine = await Immagine.create({
      id: idImmagine,
      segnalazione: reportSalvato._id,
      url: pathFoto
    });

    reportSalvato.immagini.push(immagine._id);
    await reportSalvato.save();

    const utente = await Utente.findById(req.utente.mongoId);

    if (utente?.email) {
      try {
        await inviaEmail(
          utente.email,
          'Segnalazione ricevuta - Bivacs',
          `
            <h2>Segnalazione ricevuta</h2>
            <p>La tua segnalazione è stata registrata correttamente.</p>
            <p><strong>Descrizione:</strong> ${req.body.descrizione}</p>
            <p>Il team di supporto la prenderà in carico il prima possibile.</p>
          `
        );
      } catch (emailError) {
        console.error(
          'Errore invio email conferma segnalazione:',
          emailError.message
        );
      }
    }

    const segnalazionePopolata = await Segnalazione.findById(reportSalvato._id)
      .populate('immagini')
      .populate('bivaccoId', 'nome zona altitudine')
      .populate('utenteId', 'email nome cognome');

    res.status(201).json({
      messaggio: 'Segnalazione creata con successo',
      segnalazione: segnalazionePopolata
    });
  } catch (error) {
    res.status(400).json({
      errore: error.message
    });
  }
});

/**
 * Recupera le segnalazioni attive.
 *
 * L'operazione:
 * - esclude le segnalazioni archiviate;
 * - include immagini, utente e bivacco associati;
 * - ordina i risultati dalla segnalazione più recente.
 *
 * @route GET /api/v1/segnalazioni/attive
 * @access Private
 */
router.get('/attive', protectRoute, async (req, res) => {
  try {
    const segnalazioni = await Segnalazione.find({
      statoSegnalazione: { $ne: 'archiviata' }
    })
      .populate('immagini')
      .populate('utenteId', 'email nome cognome')
      .populate('bivaccoId', 'nome zona altitudine')
      .sort({ createdAt: -1 });

    res.json(segnalazioni);
  } catch (err) {
    res.status(500).json({
      message: err.message || 'Errore nel recupero delle segnalazioni'
    });
  }
});

/**
 * Recupera lo storico completo delle segnalazioni.
 *
 * L'operazione:
 * - recupera tutte le segnalazioni;
 * - include immagini, utente e bivacco associati;
 * - ordina i risultati dalla segnalazione più recente.
 *
 * @route GET /api/v1/segnalazioni/storico
 * @access Private - Staff
 */
router.get('/storico', protectRoute, isStaff, async (req, res) => {
  try {
    const storico = await Segnalazione.find()
      .populate('immagini')
      .populate('utenteId', 'email nome cognome discriminator ente matricola')
      .populate('bivaccoId', 'nome zona altitudine')
      .sort({ createdAt: -1 });

    res.json(storico);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore nel recupero dello storico.'
    });
  }
});

/**
 * Recupera le segnalazioni associate a un bivacco.
 *
 * L'operazione:
 * - filtra le segnalazioni tramite id del bivacco;
 * - limita la visibilità per gli utenti standard;
 * - include immagini e dati dell'utente autore;
 * - ordina i risultati dalla segnalazione più recente.
 *
 * @route GET /api/v1/segnalazioni/bivacco/:bivaccoId
 * @access Private
 */
router.get('/bivacco/:bivaccoId', protectRoute, async (req, res) => {
  try {
    const { bivaccoId } = req.params;
    const { discriminator } = req.utente;

    const queryFilter = {
      bivaccoId
    };

    if (discriminator === 'UtenteRegistrato') {
      queryFilter.statoSegnalazione = {
        $in: ['inviata', 'presa_in_carico', 'in_corso']
      };
    }

    const segnalazioni = await Segnalazione.find(queryFilter)
      .populate('immagini')
      .populate('utenteId', 'email nome cognome')
      .sort({ createdAt: -1 });

    res.json(segnalazioni);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore nel recupero delle segnalazioni per questo bivacco.'
    });
  }
});

/**
 * Aggiorna lo stato di una segnalazione.
 *
 * L'operazione:
 * - cerca la segnalazione tramite ObjectId MongoDB;
 * - aggiorna lo stato con il valore ricevuto;
 * - valida il nuovo stato;
 * - restituisce la segnalazione aggiornata.
 *
 * @route PATCH /api/v1/segnalazioni/:id/stato
 * @access Private - Staff
 */
router.patch('/:id/stato', protectRoute, isStaff, async (req, res) => {
  try {
    const { nuovoStato } = req.body;

    const segnalazioneAggiornata = await Segnalazione.findByIdAndUpdate(
      req.params.id,
      { statoSegnalazione: nuovoStato },
      {
        new: true,
        runValidators: true
      }
    )
      .populate('immagini')
      .populate('utenteId', 'email nome cognome')
      .populate('bivaccoId', 'nome zona altitudine');

    if (!segnalazioneAggiornata) {
      return res.status(404).json({
        errore: 'Segnalazione non trovata'
      });
    }

    res.json({
      messaggio: 'Stato aggiornato con successo',
      segnalazione: segnalazioneAggiornata
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        errore: 'Stato non valido. Usa uno dei valori permessi.'
      });
    }

    res.status(500).json({
      errore: 'Errore durante l\'aggiornamento'
    });
  }
});

/**
 * Recupera le segnalazioni inviate dall'utente autenticato.
 *
 * L'operazione:
 * - filtra le segnalazioni tramite id dell'utente nel token;
 * - include immagini e dati del bivacco associato;
 * - ordina i risultati dalla segnalazione più recente.
 *
 * @route GET /api/v1/segnalazioni/mie
 * @access Private
 */
router.get('/mie', protectRoute, async (req, res) => {
  try {
    const segnalazioni = await Segnalazione.find({
      utenteId: req.utente.mongoId
    })
      .populate('immagini')
      .populate('bivaccoId', 'nome zona altitudine')
      .sort({ createdAt: -1 });

    res.status(200).json(segnalazioni);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore nel recupero delle tue segnalazioni.'
    });
  }
});

module.exports = router;