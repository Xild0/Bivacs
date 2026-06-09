/**
 * @file meteo.js
 * @description API REST per la gestione dei dati meteo dei bivacchi.
 *
 * Include:
 * - allerte meteo per i bivacchi preferiti;
 * - dati meteo sintetici;
 * - osservazioni meteo realtime;
 * - previsioni meteo;
 * - log delle chiamate ai provider esterni.
 */

const express = require('express');
const router = express.Router();

const Bivacco = require('../models/bivacco');
const DatoMeteo = require('../models/datoMeteo');
const LogAPI = require('../models/logAPI');
const ConfigAPI = require('../models/configAPI');
const getNextSequence = require('../utils/getNewSequence');
const { protectRoute } = require('../middlewares/authMiddleware');
const meteoTrentino = require('../utils/meteoTrentino');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Recupera l'URL base configurato per un provider API.
 *
 * Se il provider non è configurato, disabilitato o non leggibile,
 * restituisce l'URL di fallback.
 *
 * @param {string} provider - Nome del provider API.
 * @param {string} fallbackUrl - URL usato come valore di fallback.
 * @returns {Promise<string>} URL base da utilizzare.
 */

async function getProviderBaseUrl(provider, fallbackUrl) {
  try {
    const config = await ConfigAPI.findOne({ provider });

    if (config && config.enabled && config.baseUrl) {
      return config.baseUrl;
    }

    return fallbackUrl;
  } catch (error) {
    console.error(`Errore lettura ConfigAPI per ${provider}:`, error.message);
    return fallbackUrl;
  }
}

/**
 * Calcola il livello di rischio meteo in base a vento e precipitazioni.
 *
 * @param {number} vento - Velocità del vento.
 * @param {number} precipitazioni - Quantità di precipitazioni.
 * @returns {'basso'|'moderato'|'marcato'|'forte'} Livello di rischio calcolato.
 */

function calcolaLivelloRischio(vento, precipitazioni) {
  if (vento >= 70 || precipitazioni >= 20) return 'forte';
  if (vento >= 50 || precipitazioni >= 10) return 'marcato';
  if (vento >= 30 || precipitazioni >= 5) return 'moderato';
  return 'basso';
}

/**
 * Determina se le condizioni meteo sono avverse.
 *
 * @param {number} vento - Velocità del vento.
 * @param {number} precipitazioni - Quantità di precipitazioni.
 * @returns {boolean} True se le condizioni sono considerate avverse.
 */

function isMeteoAvverso(vento, precipitazioni) {
  return vento >= 50 || precipitazioni >= 10;
}

/**
 * Registra l'esito di una chiamata verso un provider esterno.
 *
 * @param {string} provider - Nome del provider chiamato.
 * @param {boolean} esito - Esito della chiamata.
 * @param {string} [dettaglioErrore=''] - Dettaglio opzionale in caso di errore.
 * @returns {Promise<void>}
 */

async function salvaLog(provider, esito, dettaglioErrore = '') {
  try {
    const id = await getNextSequence('logApiId');

    await LogAPI.create({
      id,
      provider,
      esito,
      dettaglioErrore
    });
  } catch (error) {
    console.error('Errore salvataggio log API:', error.message);
  }
}

/**
 * Recupera le allerte meteo dei bivacchi preferiti.
 *
 * L'operazione:
 * - recupera i preferiti dell'utente autenticato;
 * - interroga il provider meteo;
 * - calcola il livello di rischio;
 * - restituisce eventuali condizioni meteo avverse.
 *
 * @route GET /api/v1/meteo/preferiti/allerte
 * @access Private
 */

router.get('/preferiti/allerte', protectRoute, async (req, res) => {
  try {
    const UtenteRegistrato = require('../models/utenteRegistrato');

    const utente = await UtenteRegistrato.findById(req.utente.mongoId)
      .populate('preferiti');

    if (!utente) {
      return res.status(404).json({
        message: 'Utente registrato non trovato'
      });
    }

    const openMeteoUrl = await getProviderBaseUrl('Open-Meteo', OPEN_METEO_URL);
    const risultati = [];

    for (const bivacco of utente.preferiti) {
      const url =
        `${openMeteoUrl}?latitude=${bivacco.latitudine}` +
        `&longitude=${bivacco.longitudine}` +
        `&current=temperature_2m,wind_speed_10m,precipitation` +
        `&timezone=Europe%2FRome`;

      const response = await fetch(url);

      if (!response.ok) {
        await salvaLog('Open-Meteo', false, `HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      const temperatura = data.current?.temperature_2m ?? 0;
      const vento = data.current?.wind_speed_10m ?? 0;
      const precipitazioni = data.current?.precipitation ?? 0;

      risultati.push({
        bivacco: {
          id: bivacco._id,
          nome: bivacco.nome,
          altitudine: bivacco.altitudine,
          zona: bivacco.zona
        },
        meteo: {
          temperatura,
          vento,
          precipitazioni,
          livelloRischio: calcolaLivelloRischio(vento, precipitazioni),
          allerta: isMeteoAvverso(vento, precipitazioni)
        }
      });
    }

    await salvaLog('Open-Meteo', true);

    res.status(200).json({
      totalePreferiti: utente.preferiti.length,
      allerte: risultati
    });
  } catch (error) {
    await salvaLog('Open-Meteo', false, error.message);

    res.status(500).json({
      message: 'Errore recupero allerte preferiti',
      error: error.message
    });
  }
});

/**
 * Recupera dati meteo sintetici per più bivacchi.
 *
 * L'operazione:
 * - riceve un array di id bivacco;
 * - recupera i bivacchi dal database;
 * - interroga il provider meteo;
 * - restituisce temperatura, vento, precipitazioni e rischio.
 *
 * @route POST /api/v1/meteo/sintetico
 * @access Public
 */

router.post('/sintetico', async (req, res) => {
  try {
    const { bivacchiIds } = req.body;

    if (!Array.isArray(bivacchiIds) || bivacchiIds.length === 0) {
      return res.status(400).json({
        message: 'Fornire un array bivacchiIds non vuoto'
      });
    }

    const bivacchi = await Bivacco.find({
      _id: { $in: bivacchiIds }
    });

    const openMeteoUrl = await getProviderBaseUrl('Open-Meteo', OPEN_METEO_URL);
    const risultati = [];

    for (const bivacco of bivacchi) {
      const url =
        `${openMeteoUrl}?latitude=${bivacco.latitudine}` +
        `&longitude=${bivacco.longitudine}` +
        `&current=temperature_2m,wind_speed_10m,precipitation` +
        `&timezone=Europe%2FRome`;

      const response = await fetch(url);

      if (!response.ok) {
        await salvaLog('Open-Meteo', false, `HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      const temperatura = data.current?.temperature_2m ?? 0;
      const vento = data.current?.wind_speed_10m ?? 0;
      const precipitazioni = data.current?.precipitation ?? 0;

      risultati.push({
        bivaccoId: bivacco._id,
        nome: bivacco.nome,
        temperatura,
        vento,
        precipitazioni,
        livelloRischio: calcolaLivelloRischio(vento, precipitazioni),
        allerta: isMeteoAvverso(vento, precipitazioni)
      });
    }

    await salvaLog('Open-Meteo', true);

    res.status(200).json({
      meteoSintetico: risultati
    });
  } catch (error) {
    await salvaLog('Open-Meteo', false, error.message);

    res.status(500).json({
      message: 'Errore recupero meteo sintetico',
      error: error.message
    });
  }
});

/**
 * Recupera il meteo realtime di un bivacco.
 *
 * L'operazione:
 * - cerca il bivacco tramite ObjectId MongoDB;
 * - recupera le osservazioni meteo disponibili;
 * - calcola allerta e livello di rischio;
 * - salva il dato meteo nel database.
 *
 * @route GET /api/v1/meteo/:bivaccoId
 * @access Public
 */

router.get('/:bivaccoId', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId);

    if (!bivacco) {
      return res.status(404).json({ message: 'Bivacco non trovato' });
    }

    const { temperatura, vento, precipitazioni, provider, stazione } =
      await getOsservazioni(bivacco.latitudine, bivacco.longitudine);

    const livelloRischio = calcolaLivelloRischio(vento, precipitazioni);
    const allertaPAT = isMeteoAvverso(vento, precipitazioni);

    const idMeteo = await getNextSequence('datoMeteoId');

    const datoMeteo = await DatoMeteo.create({
      id: idMeteo,
      bivacco: bivacco._id,
      temperatura,
      vento,
      precipitazioni,
      allertaPAT,
      livelloRischio,
      aggiornato: new Date()
    });

    res.status(200).json({
      bivacco: {
        id: bivacco._id,
        nome: bivacco.nome
      },
      provider,
      stazione: stazione || null,
      meteo: datoMeteo
    });
  } catch (error) {
    res.status(500).json({
      message: 'Errore recupero meteo',
      error: error.message
    });
  }
});

/**
 * Recupera le previsioni meteo di un bivacco.
 *
 * L'operazione:
 * - cerca il bivacco tramite ObjectId MongoDB;
 * - interroga il provider Open-Meteo;
 * - elabora le previsioni dei giorni successivi;
 * - calcola allerta e livello di rischio giornaliero.
 *
 * @route GET /api/v1/meteo/:bivaccoId/previsioni
 * @access Public
 */

router.get('/:bivaccoId/previsioni', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const openMeteoUrl = await getProviderBaseUrl('Open-Meteo', OPEN_METEO_URL);

    const url =
      `${openMeteoUrl}?latitude=${bivacco.latitudine}` +
      `&longitude=${bivacco.longitudine}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
      `&forecast_days=3` +
      `&timezone=Europe%2FRome`;

    const response = await fetch(url);

    if (!response.ok) {
      await salvaLog('Open-Meteo', false, `HTTP ${response.status}`);
      return res.status(502).json({
        message: 'Errore nella chiamata al provider meteo'
      });
    }

    const data = await response.json();

    const previsioni = data.daily.time.map((giorno, index) => {
      const vento = data.daily.wind_speed_10m_max[index];
      const precipitazioni = data.daily.precipitation_sum[index];

      return {
        giorno,
        temperaturaMin: data.daily.temperature_2m_min[index],
        temperaturaMax: data.daily.temperature_2m_max[index],
        precipitazioni,
        ventoMax: vento,
        livelloRischio: calcolaLivelloRischio(vento, precipitazioni),
        allerta: isMeteoAvverso(vento, precipitazioni)
      };
    });

    await salvaLog('Open-Meteo', true);

    res.status(200).json({
      bivacco: {
        id: bivacco._id,
        nome: bivacco.nome
      },
      previsioni
    });
  } catch (error) {
    await salvaLog('Open-Meteo', false, error.message);

    res.status(500).json({
      message: 'Errore recupero previsioni',
      error: error.message
    });
  }
});

/**
 * Recupera le osservazioni meteo per le coordinate indicate.
 *
 * Prova prima MeteoTrentino e, in caso di errore,
 * utilizza Open-Meteo come provider di fallback.
 *
 * @param {number} lat - Latitudine del bivacco.
 * @param {number} lon - Longitudine del bivacco.
 * @returns {Promise<Object>} Dati meteo osservati e provider utilizzato.
 */

async function getOsservazioni(lat, lon) {
  try {
    const dati = await meteoTrentino.getOsservazioniVicine(lat, lon);
    await salvaLog('MeteoTrentino', true);
    return {
      ...dati,
      provider: 'MeteoTrentino'
    };
  } catch (errMT) {
    await salvaLog('MeteoTrentino', false, errMT.message);
  }

  const openMeteoUrl = await getProviderBaseUrl('Open-Meteo', OPEN_METEO_URL);

  const url =
    `${openMeteoUrl}?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,precipitation` +
    `&timezone=Europe%2FRome`;

  const response = await fetch(url);

  if (!response.ok) {
    await salvaLog('Open-Meteo', false, `HTTP ${response.status}`);
    throw new Error('Nessun provider meteo disponibile');
  }

  const data = await response.json();

  await salvaLog('Open-Meteo', true);

  return {
    temperatura: data.current?.temperature_2m ?? 0,
    vento: data.current?.wind_speed_10m ?? 0,
    precipitazioni: data.current?.precipitation ?? 0,
    provider: 'Open-Meteo'
  };
}

module.exports = router;