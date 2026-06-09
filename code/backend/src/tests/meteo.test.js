/**
 * @file meteo.test.js
 * @description Test di integrazione per gli endpoint meteo (US17-US19).
 * I provider esterni sono mockati per rendere i test deterministici:
 * - MeteoTrentino (provider primario) tramite jest.mock del modulo utility;
 * - Open-Meteo (fallback e previsioni) tramite mock della fetch globale.
 * Riferimento tabella test D4: TC69-TC75.
 */

// jest.mock viene hoistato sopra le require: il modulo è mockato prima che
// la route meteo lo importi.
jest.mock('../utils/meteoTrentino');

const request = require('supertest');
const { connectTestDb, closeTestDb } = require('./helpers');
const meteoTrentino = require('../utils/meteoTrentino');
const app = require('../app');
const Bivacco = require('../models/bivacco');

let bivaccoId;
const realFetch = global.fetch;

beforeAll(async () => {
  await connectTestDb();
  const b = await Bivacco.create({
    id: 1, nome: 'Bivacco Meteo',
    latitudine: 46.0, longitudine: 11.2, altitudine: 2000,
    postiLetto: 2, zona: 'Test'
  });
  bivaccoId = b._id;
});

afterAll(async () => {
  global.fetch = realFetch;
  await closeTestDb();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/meteo/:bivaccoId — meteo realtime (US17)', () => {
  test('TC69 - dati da MeteoTrentino (provider primario)', async () => {
    meteoTrentino.getOsservazioniVicine.mockResolvedValue({
      temperatura: 5,
      vento: 12,
      precipitazioni: 0,
      stazione: { codice: 'T0410', nome: 'Trento Laste', distanza: 1200 }
    });

    const res = await request(app).get(`/api/v1/meteo/${bivaccoId}`);
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('MeteoTrentino');
    expect(res.body.meteo.temperatura).toBe(5);
    expect(res.body.meteo).toHaveProperty('livelloRischio');
    expect(res.body.stazione.codice).toBe('T0410');
  });

  test('TC71 - fallback su Open-Meteo se MeteoTrentino fallisce', async () => {
    meteoTrentino.getOsservazioniVicine.mockRejectedValue(new Error('MT non disponibile'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 3, wind_speed_10m: 20, precipitation: 1 }
      })
    });

    const res = await request(app).get(`/api/v1/meteo/${bivaccoId}`);
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('Open-Meteo');
    expect(res.body.meteo.temperatura).toBe(3);
  });

  test('TC70 - bivacco inesistente -> 404', async () => {
    const res = await request(app).get('/api/v1/meteo/000000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/meteo/sintetico — meteo sintetico (US18)', () => {
  test('TC73 - array bivacchiIds vuoto -> 400', async () => {
    const res = await request(app)
      .post('/api/v1/meteo/sintetico')
      .send({ bivacchiIds: [] });
    expect(res.status).toBe(400);
  });

  test('TC72 - meteo sintetico per più bivacchi', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 7, wind_speed_10m: 10, precipitation: 0 }
      })
    });

    const res = await request(app)
      .post('/api/v1/meteo/sintetico')
      .send({ bivacchiIds: [String(bivaccoId)] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.meteoSintetico)).toBe(true);
    expect(res.body.meteoSintetico[0]).toHaveProperty('allerta');
  });
});

describe('GET /api/v1/meteo/:bivaccoId/previsioni — previsioni (US19)', () => {
  test('TC74 - previsioni a 3 giorni', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-06-10', '2026-06-11', '2026-06-12'],
          temperature_2m_min: [4, 5, 6],
          temperature_2m_max: [14, 15, 16],
          precipitation_sum: [0, 2, 1],
          wind_speed_10m_max: [10, 20, 15]
        }
      })
    });

    const res = await request(app).get(`/api/v1/meteo/${bivaccoId}/previsioni`);
    expect(res.status).toBe(200);
    expect(res.body.previsioni).toHaveLength(3);
    expect(res.body.previsioni[0]).toHaveProperty('livelloRischio');
  });

  test('TC75 - provider non raggiungibile -> 502', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const res = await request(app).get(`/api/v1/meteo/${bivaccoId}/previsioni`);
    expect(res.status).toBe(502);
  });
});
