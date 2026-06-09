/**
 * @file supporto.js
 * @description API REST riservata al Supporto Tecnico.
 *
 * Include:
 * - gestione dei log API;
 * - configurazione dei provider esterni;
 * - creazione e modifica dei bivacchi;
 * - gestione delle richieste di promozione;
 * - consultazione delle segnalazioni;
 * - gestione dei ticket di manutenzione;
 * - esportazione dei dati in formato CSV.
 */

const express = require('express');
const router = express.Router();

const LogAPI = require('../models/logAPI');
const ConfigAPI = require('../models/configAPI');
const Bivacco = require('../models/bivacco');
const Utente = require('../models/utente');
const Segnalazione = require('../models/segnalazione');
const TicketManutenzione = require('../models/ticketManutenzione');

const { protectRoute, isStaff } = require('../middlewares/authMiddleware');
const getNextSequence = require('../utils/getNewSequence');
const inviaEmail = require('../utils/emailService');

/**
 * Verifica che l'utente autenticato abbia ruolo SupportoTecnico.
 *
 * Deve essere usato dopo protectRoute, perché legge i dati
 * dell'utente già decodificati dal token JWT.
 *
 * @param {import('express').Request} req - Richiesta Express.
 * @param {import('express').Response} res - Risposta Express.
 * @param {import('express').NextFunction} next - Middleware successivo.
 * @returns {void}
 */

function isSupportoTecnico(req, res, next) {
  if (req.utente.discriminator === 'SupportoTecnico') {
    return next();
  }

  return res.status(403).json({
    errore: 'Accesso negato. Solo il Supporto Tecnico può accedere.'
  });
}

/**
 * Recupera i log delle API esterne.
 *
 * L'operazione:
 * - recupera gli ultimi log registrati;
 * - ordina i risultati dal più recente;
 * - limita il numero di record restituiti.
 *
 * @route GET /api/v1/supporto/log-api
 * @access Private - SupportoTecnico
 */

router.get('/log-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const logs = await LogAPI.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero log API',
      error: error.message
    });
  }
});

/**
 * Recupera le configurazioni dei provider API.
 *
 * L'operazione restituisce tutte le configurazioni
 * ordinate per provider.
 *
 * @route GET /api/v1/supporto/config-api
 * @access Private - SupportoTecnico
 */

router.get('/config-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const configs = await ConfigAPI.find().sort({ provider: 1 });
    res.status(200).json(configs);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero configurazioni API',
      error: error.message
    });
  }
});

/**
 * Crea una nuova configurazione API.
 *
 * L'operazione:
 * - valida i campi obbligatori;
 * - verifica che il provider non esista già;
 * - salva la configurazione nel database.
 *
 * @route POST /api/v1/supporto/config-api
 * @access Private - SupportoTecnico
 */

router.post('/config-api', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { provider, baseUrl, enabled, timeoutMs } = req.body;

    if (!provider || !baseUrl) {
      return res.status(400).json({
        message: 'provider e baseUrl sono obbligatori'
      });
    }

    const esistente = await ConfigAPI.findOne({ provider });

    if (esistente) {
      return res.status(409).json({
        message: 'Esiste già una configurazione per questo provider'
      });
    }

    const id = await getNextSequence('configApiId');

    const nuovaConfig = await ConfigAPI.create({
      id,
      provider,
      baseUrl,
      enabled: enabled !== undefined ? enabled : true,
      timeoutMs: timeoutMs || 5000
    });

    res.status(201).json(nuovaConfig);
  } catch (error) {
    res.status(500).json({
      message: 'Errore creazione configurazione API',
      error: error.message
    });
  }
});

/**
 * Aggiorna una configurazione API.
 *
 * L'operazione:
 * - aggiorna i campi ricevuti nel body;
 * - valida i nuovi valori;
 * - restituisce la configurazione aggiornata.
 *
 * @route PATCH /api/v1/supporto/config-api/:id
 * @access Private - SupportoTecnico
 */

router.patch('/config-api/:id', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { baseUrl, enabled, timeoutMs } = req.body;
    const aggiornamenti = {};

    if (baseUrl !== undefined) aggiornamenti.baseUrl = baseUrl;
    if (enabled !== undefined) aggiornamenti.enabled = enabled;
    if (timeoutMs !== undefined) aggiornamenti.timeoutMs = timeoutMs;

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno un campo da aggiornare'
      });
    }

    const configAggiornata = await ConfigAPI.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { new: true, runValidators: true }
    );

    if (!configAggiornata) {
      return res.status(404).json({
        message: 'Configurazione API non trovata'
      });
    }

    res.status(200).json({
      message: 'Configurazione API aggiornata con successo',
      config: configAggiornata
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore modifica configurazione API',
      error: error.message
    });
  }
});

/**
 * Aggiorna un bivacco esistente.
 *
 * L'operazione:
 * - aggiorna i campi ricevuti nel body;
 * - valida i dati inseriti;
 * - salva le modifiche nel database.
 *
 * @route PATCH /api/v1/supporto/bivacchi/:id
 * @access Private - SupportoTecnico
 */

router.patch('/bivacchi/:id', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      acquaPresente,
      legnaDisponibile,
      emergenza
    } = req.body;

    const aggiornamenti = {};

    if (nome !== undefined) aggiornamenti.nome = nome;
    if (latitudine !== undefined) aggiornamenti.latitudine = Number(latitudine);
    if (longitudine !== undefined) aggiornamenti.longitudine = Number(longitudine);
    if (altitudine !== undefined) aggiornamenti.altitudine = Number(altitudine);
    if (postiLetto !== undefined) aggiornamenti.postiLetto = Number(postiLetto);
    if (dotazioni !== undefined) aggiornamenti.dotazioni = dotazioni;
    if (zona !== undefined) aggiornamenti.zona = zona;
    if (tipoStruttura !== undefined) aggiornamenti.tipoStruttura = tipoStruttura;
    if (acquaPresente !== undefined) aggiornamenti.acquaPresente = acquaPresente;
    if (legnaDisponibile !== undefined) aggiornamenti.legnaDisponibile = legnaDisponibile;
    if (emergenza !== undefined) aggiornamenti.emergenza = emergenza;

    if (Object.keys(aggiornamenti).length === 0) {
      return res.status(400).json({
        message: 'Fornire almeno un campo da aggiornare'
      });
    }

    const bivaccoAggiornato = await Bivacco.findByIdAndUpdate(
      req.params.id,
      { $set: aggiornamenti },
      { new: true, runValidators: true }
    );

    if (!bivaccoAggiornato) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    res.status(200).json({
      message: 'Bivacco aggiornato con successo',
      bivacco: bivaccoAggiornato
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore modifica bivacco',
      error: error.message
    });
  }
});

/**
 * Crea un nuovo bivacco.
 *
 * L'operazione:
 * - valida i campi obbligatori;
 * - genera un nuovo id numerico;
 * - salva il bivacco nel database.
 *
 * @route POST /api/v1/supporto/bivacchi
 * @access Private - SupportoTecnico
 */

router.post('/bivacchi', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const {
      nome,
      latitudine,
      longitudine,
      altitudine,
      postiLetto,
      dotazioni,
      zona,
      tipoStruttura,
      acquaPresente,
      legnaDisponibile,
      emergenza
    } = req.body;

    if (
      !nome ||
      latitudine === undefined ||
      longitudine === undefined ||
      altitudine === undefined ||
      !zona
    ) {
      return res.status(400).json({
        message: 'Campi obbligatori mancanti (nome, latitudine, longitudine, altitudine, zona)'
      });
    }

    const id = await getNextSequence('bivaccoId');

    const nuovoBivacco = await Bivacco.create({
      id,
      nome,
      latitudine: Number(latitudine),
      longitudine: Number(longitudine),
      altitudine: Number(altitudine),
      postiLetto: Number(postiLetto) || 0,
      dotazioni: dotazioni || '',
      zona,
      tipoStruttura: tipoStruttura || 'fisso',
      emergenza: emergenza || false,
      acquaPresente: acquaPresente !== undefined ? acquaPresente : true,
      legnaDisponibile: legnaDisponibile !== undefined ? legnaDisponibile : true
    });

    res.status(201).json({
      message: 'Bivacco creato con successo',
      bivacco: nuovoBivacco
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Errore validazione',
        error: error.message
      });
    }

    res.status(500).json({
      message: 'Errore creazione bivacco',
      error: error.message
    });
  }
});

/**
 * Recupera le richieste di promozione a Supporto Tecnico.
 *
 * Restituisce tutte le richieste attualmente
 * in stato di attesa.
 *
 * @route GET /api/v1/supporto/richieste-supporto
 * @access Private - SupportoTecnico
 */

router.get('/richieste-supporto', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const richieste = await Utente.find({
      discriminator: 'UtenteRegistrato',
      'richiestaSupportoTecnico.stato': 'in_attesa'
    }).select('-passwordHash');

    res.status(200).json(richieste);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero richieste supporto tecnico',
      error: error.message
    });
  }
});

/**
 * Approva una richiesta di Supporto Tecnico.
 *
 * L'operazione:
 * - verifica che la richiesta sia valida;
 * - assegna una matricola;
 * - promuove l'utente;
 * - invia una email di conferma.
 *
 * @route PATCH /api/v1/supporto/richieste-supporto/:utenteId/approva
 * @access Private - SupportoTecnico
 */

router.patch('/richieste-supporto/:utenteId/approva', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.utenteId);

    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    if (utente.richiestaSupportoTecnico?.stato !== 'in_attesa') {
      return res.status(400).json({
        message: 'Richiesta già gestita'
      });
    }

    const numeroMatricola = await getNextSequence('supportoTecnicoMatricola');
    const matricola = `ST-${String(numeroMatricola).padStart(4, '0')}`;

    await Utente.collection.updateOne(
      { _id: utente._id },
      {
        $set: {
          discriminator: 'SupportoTecnico',
          matricola,
          'richiestaSupportoTecnico.stato': 'approvata',
          'richiestaSupportoTecnico.matricolaRichiesta': ''
        }
      }
    );

    const aggiornato = await Utente.findById(req.params.utenteId).select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta Supporto Tecnico approvata',
      `
        <h2>Richiesta approvata</h2>
        <p>La tua richiesta per diventare Supporto Tecnico su Bivacs è stata approvata.</p>
        <p><strong>Matricola assegnata:</strong> ${matricola}</p>
        <p>Effettua nuovamente il login per accedere al pannello tecnico.</p>
      `
    );

    res.status(200).json({
      message: 'Utente promosso a Supporto Tecnico',
      utente: aggiornato
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore approvazione richiesta',
      error: error.message
    });
  }
});

/**
 * Rifiuta una richiesta di Supporto Tecnico.
 *
 * L'operazione:
 * - aggiorna lo stato della richiesta;
 * - registra il rifiuto;
 * - invia una email all'utente.
 *
 * @route PATCH /api/v1/supporto/richieste-supporto/:utenteId/rifiuta
 * @access Private - SupportoTecnico
 */

router.patch('/richieste-supporto/:utenteId/rifiuta', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { motivoRifiuto } = req.body;

    const utenteCorrente = await Utente.findById(req.params.utenteId);

    if (!utenteCorrente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    if (utenteCorrente.richiestaSupportoTecnico?.stato !== 'in_attesa') {
      return res.status(400).json({
        message: 'Richiesta già gestita'
      });
    }

    const utente = await Utente.findByIdAndUpdate(
      req.params.utenteId,
      {
        $set: {
          'richiestaSupportoTecnico.stato': 'rifiutata'
        }
      },
      { new: true }
    ).select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta Supporto Tecnico rifiutata',
      `
        <h2>Richiesta rifiutata</h2>
        <p>La tua richiesta per diventare Supporto Tecnico su Bivacs è stata rifiutata.</p>
        <p>${motivoRifiuto || 'Non è stata indicata una motivazione specifica.'}</p>
      `
    );

    res.status(200).json({
      message: 'Richiesta rifiutata correttamente',
      utente
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore rifiuto richiesta',
      error: error.message
    });
  }
});

/**
 * Recupera le richieste di promozione a SuperUser.
 *
 * Restituisce tutte le richieste attualmente
 * in stato di attesa.
 *
 * @route GET /api/v1/supporto/richieste-superuser
 * @access Private - SupportoTecnico
 */

router.get('/richieste-superuser', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const richieste = await Utente.find({
      discriminator: 'UtenteRegistrato',
      'richiestaSuperUser.stato': 'in_attesa'
    }).select('-passwordHash');

    res.status(200).json(richieste);
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero richieste SuperUser',
      error: error.message
    });
  }
});

/**
 * Approva una richiesta di SuperUser.
 *
 * L'operazione:
 * - verifica che la richiesta sia valida;
 * - promuove l'utente;
 * - assegna i privilegi previsti;
 * - invia una email di conferma.
 *
 * @route PATCH /api/v1/supporto/richieste-superuser/:utenteId/approva
 * @access Private - SupportoTecnico
 */

router.patch('/richieste-superuser/:utenteId/approva', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.utenteId);

    if (!utente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    if (utente.richiestaSuperUser?.stato !== 'in_attesa') {
      return res.status(400).json({
        message: 'Richiesta già gestita'
      });
    }

    await Utente.collection.updateOne(
      { _id: utente._id },
      {
        $set: {
          discriminator: 'SuperUser',
          ente: process.env.DEFAULT_SUPERUSER_ENTE || 'SAT',
          livelloAuth: Number(process.env.DEFAULT_SUPERUSER_LIVELLO_AUTH || 5),
          'richiestaSuperUser.stato': 'approvata'
        }
      }
    );

    const aggiornato = await Utente.findById(req.params.utenteId).select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta SuperUser approvata',
      `
        <h2>Richiesta approvata</h2>
        <p>Sei stato promosso a SuperUser su Bivacs.</p>
        <p>Effettua nuovamente il login per accedere al pannello.</p>
      `
    );

    res.status(200).json({
      message: 'Utente promosso a SuperUser',
      utente: aggiornato
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore approvazione richiesta',
      error: error.message
    });
  }
});

/**
 * Rifiuta una richiesta di SuperUser.
 *
 * L'operazione:
 * - aggiorna lo stato della richiesta;
 * - registra il rifiuto;
 * - invia una email all'utente.
 *
 * @route PATCH /api/v1/supporto/richieste-superuser/:utenteId/rifiuta
 * @access Private - SupportoTecnico
 */

router.patch('/richieste-superuser/:utenteId/rifiuta', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { motivoRifiuto } = req.body;

    const utenteCorrente = await Utente.findById(req.params.utenteId);

    if (!utenteCorrente) {
      return res.status(404).json({
        message: 'Utente non trovato'
      });
    }

    if (utenteCorrente.richiestaSuperUser?.stato !== 'in_attesa') {
      return res.status(400).json({
        message: 'Richiesta già gestita'
      });
    }

    const utente = await Utente.findByIdAndUpdate(
      req.params.utenteId,
      {
        $set: {
          'richiestaSuperUser.stato': 'rifiutata'
        }
      },
      { new: true }
    ).select('-passwordHash');

    await inviaEmail(
      utente.email,
      'Richiesta SuperUser rifiutata',
      `
        <h2>Richiesta rifiutata</h2>
        <p>La tua richiesta per diventare SuperUser su Bivacs è stata rifiutata.</p>
        <p>${motivoRifiuto || 'Non è stata indicata una motivazione specifica.'}</p>
      `
    );

    res.status(200).json({
      message: 'Richiesta rifiutata correttamente',
      utente
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore rifiuto richiesta',
      error: error.message
    });
  }
});

/**
 * Recupera le segnalazioni attive.
 *
 * L'operazione:
 * - esclude le segnalazioni archiviate;
 * - include utente e bivacco associati;
 * - ordina i risultati dalla più recente.
 *
 * @route GET /api/v1/supporto/segnalazioni
 * @access Private - SupportoTecnico
 */

router.get('/segnalazioni', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const segnalazioni = await Segnalazione.find({
      statoSegnalazione: { $ne: 'archiviata' }
    })
      .populate('utenteId', 'nome cognome email')
      .populate('bivaccoId', 'nome zona altitudine')
      .sort({ createdAt: -1 });

    res.status(200).json(segnalazioni);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore recupero segnalazioni',
      dettaglio: error.message
    });
  }
});

/**
 * Recupera la coda dei ticket di manutenzione.
 *
 * L'operazione:
 * - esclude i ticket archiviati;
 * - include segnalazioni e dati associati;
 * - ordina per priorità e data di apertura.
 *
 * @route GET /api/v1/supporto/ticket
 * @access Private - SupportoTecnico
 */

router.get('/ticket', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const tickets = await TicketManutenzione.find({
      stato: { $ne: 'archiviato' }
    })
      .populate({
        path: 'segnalazione',
        populate: [
          { path: 'bivaccoId', select: 'nome zona altitudine' },
          { path: 'utenteId', select: 'email nome cognome' }
        ]
      })
      .sort({ priorita: -1, dataApertura: 1 });

    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore recupero coda ticket',
      dettaglio: error.message
    });
  }
});

/**
 * Crea un nuovo ticket di manutenzione.
 *
 * L'operazione:
 * - verifica la segnalazione associata;
 * - evita ticket duplicati;
 * - crea il ticket;
 * - aggiorna lo stato della segnalazione.
 *
 * @route POST /api/v1/supporto/ticket
 * @access Private - SupportoTecnico
 */

router.post('/ticket', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { segnalazioneId, priority } = req.body;

    const segnalazione = await Segnalazione.findById(segnalazioneId);

    if (!segnalazione) {
      return res.status(404).json({
        errore: 'Segnalazione non trovata'
      });
    }

    const ticketEsistente = await TicketManutenzione.findOne({
      segnalazione: segnalazioneId,
      stato: { $ne: 'archiviato' }
    });

    if (ticketEsistente) {
      return res.status(409).json({
        errore: 'Ticket già aperto per questa segnalazione'
      });
    }

    const idNumerico = await getNextSequence('ticketId');

    const nuovoTicket = await TicketManutenzione.create({
      id: idNumerico,
      segnalazione: segnalazioneId,
      stato: 'aperto',
      priorita: priority || 5
    });

    await Segnalazione.findByIdAndUpdate(segnalazioneId, {
      statoSegnalazione: 'presa_in_carico'
    });

    res.status(201).json(nuovoTicket);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore durante la creazione del ticket',
      dettaglio: error.message
    });
  }
});

/**
 * Aggiorna lo stato di un ticket.
 *
 * L'operazione:
 * - aggiorna stato e note del ticket;
 * - sincronizza lo stato della segnalazione collegata;
 * - registra la data di chiusura se necessario.
 *
 * @route PATCH /api/v1/supporto/ticket/:id/stato
 * @access Private - SupportoTecnico
 */

router.patch('/ticket/:id/stato', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const { stato, note } = req.body;
    const updateData = { stato };

    if (note) updateData.note = note;
    if (stato === 'chiuso') updateData.dataChiusura = Date.now();

    const ticketAggiornato = await TicketManutenzione.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!ticketAggiornato) {
      return res.status(404).json({
        errore: 'Ticket non trovato'
      });
    }

    const statoSegnalazioneMap = {
      aperto: 'presa_in_carico',
      in_lavorazione: 'in_corso',
      chiuso: 'risolta',
      archiviato: 'archiviata'
    };

    if (statoSegnalazioneMap[stato]) {
      await Segnalazione.findByIdAndUpdate(ticketAggiornato.segnalazione, {
        statoSegnalazione: statoSegnalazioneMap[stato]
      });
    }

    res.status(200).json(ticketAggiornato);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore aggiornamento ticket',
      dettaglio: error.message
    });
  }
});

/**
 * Archivia un ticket chiuso.
 *
 * L'operazione:
 * - verifica che il ticket sia chiuso;
 * - aggiorna lo stato ad archiviato;
 * - archivia la segnalazione associata.
 *
 * @route PATCH /api/v1/supporto/ticket/:id/archivia
 * @access Private - SupportoTecnico
 */

router.patch('/ticket/:id/archivia', protectRoute, isSupportoTecnico, async (req, res) => {
  try {
    const ticket = await TicketManutenzione.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        errore: 'Ticket non trovato'
      });
    }

    if (ticket.stato !== 'chiuso') {
      return res.status(400).json({
        errore: 'Errore: il ticket deve essere CHIUSO per poter essere archiviato'
      });
    }

    ticket.stato = 'archiviato';
    await ticket.save();

    await Segnalazione.findByIdAndUpdate(ticket.segnalazione, {
      statoSegnalazione: 'archiviata'
    });

    res.status(200).json({
      messaggio: 'Ticket archiviato con successo',
      ticket
    });
  } catch (error) {
    res.status(500).json({
      errore: 'Errore durante l\'archiviazione',
      dettaglio: error.message
    });
  }
});

/**
 * Esporta le segnalazioni in formato CSV.
 *
 * L'operazione:
 * - recupera tutte le segnalazioni;
 * - genera un dataset CSV;
 * - restituisce il file come download.
 *
 * @route GET /api/v1/supporto/segnalazioni/export/csv
 * @access Private - Staff
 */

router.get('/segnalazioni/export/csv', protectRoute, isStaff, async (req, res) => {
  try {
    const segnalazioni = await Segnalazione.find()
      .populate('utenteId', 'email')
      .populate('bivaccoId', 'nome')
      .lean();

    if (segnalazioni.length === 0) {
      return res.status(404).json({
        errore: 'Nessuna segnalazione presente nel database.'
      });
    }

    const headers = [
      'ID Segnalazione',
      'Email Utente',
      'Nome Bivacco',
      'Stato',
      'Descrizione',
      'Data Creazione'
    ];

    const rows = segnalazioni.map(s => [
      s._id,
      s.utenteId?.email || 'Utente eliminato',
      s.bivaccoId?.nome || 'Bivacco eliminato',
      s.statoSegnalazione,
      `"${String(s.descrizione || '').replace(/"/g, '""')}"`,
      s.createdAt ? new Date(s.createdAt).toISOString() : ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(riga => riga.join(','))
    ].join('\n');

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('dataset_segnalazioni.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      errore: 'Errore durante l\'export CSV',
      dettaglio: error.message
    });
  }
});

module.exports = router;