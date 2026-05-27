/**
 * @file meteo.js
 * @description Route per dati meteo realtime e previsioni dei bivacchi.
 */

const express = require('express');
const router = express.Router();

const Bivacco = require('../models/bivacco');
const DatoMeteo = require('../models/datoMeteo');
const LogAPI = require('../models/logAPI');
const getNextSequence = require('../utils/getNewSequence');
const { protectRoute } = require('../middlewares/authMiddleware');
const meteoTrentino = require('../utils/meteoTrentino');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

function calcolaLivelloRischio(vento, precipitazioni) {
  if (vento >= 70 || precipitazioni >= 20) return 'forte';
  if (vento >= 50 || precipitazioni >= 10) return 'marcato';
  if (vento >= 30 || precipitazioni >= 5) return 'moderato';
  return 'basso';
}

function isMeteoAvverso(vento, precipitazioni) {
  return vento >= 50 || precipitazioni >= 10;
}

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
 * Allerte meteo sui bivacchi preferiti dell'utente.
 * US20.
 *
 * @route GET /api/v1/meteo/preferiti/allerte
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

    const risultati = [];

    for (const bivacco of utente.preferiti) {
      const url =
        `${OPEN_METEO_URL}?latitude=${bivacco.latitudine}` +
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

      const livelloRischio = calcolaLivelloRischio(vento, precipitazioni);
      const allerta = isMeteoAvverso(vento, precipitazioni);

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
          livelloRischio,
          allerta
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
 * Meteo sintetico per una lista di bivacchi.
 * US18.
 *
 * POST /api/v1/meteo/sintetico
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

    const risultati = [];

    for (const bivacco of bivacchi) {
      const url =
        `${OPEN_METEO_URL}?latitude=${bivacco.latitudine}` +
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
      bivacco: { id: bivacco._id, nome: bivacco.nome },
      provider,
      stazione: stazione || null,
      meteo: datoMeteo
    });
  } catch (error) {
    res.status(500).json({ message: 'Errore recupero meteo', error: error.message });
  }
});

/**
 * Previsioni a 3 giorni.
 * US19.
 */
router.get('/:bivaccoId/previsioni', async (req, res) => {
  try {
    const bivacco = await Bivacco.findById(req.params.bivaccoId);

    if (!bivacco) {
      return res.status(404).json({
        message: 'Bivacco non trovato'
      });
    }

    const url =
      `${OPEN_METEO_URL}?latitude=${bivacco.latitudine}` +
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
 * Recupera osservazioni meteo per una coordinata.
 * Prova prima MeteoTrentino (stazione più vicina), poi ripiega su Open-Meteo.
 *
 * @returns {Promise<{temperatura, vento, precipitazioni, provider, stazione?}>}
 */
async function getOsservazioni(lat, lon) {
  // 1) MeteoTrentino
  try {
    const dati = await meteoTrentino.getOsservazioniVicine(lat, lon);
    await salvaLog('MeteoTrentino', true);
    return { ...dati, provider: 'MeteoTrentino' };
  } catch (errMT) {
    await salvaLog('MeteoTrentino', false, errMT.message);
  }

  // 2) Fallback Open-Meteo
  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
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