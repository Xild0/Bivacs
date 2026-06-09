/**
 * @file supporto.test.js
 * @description Test di integrazione per il pannello Supporto Tecnico (US38-US40).
 * Verifica autorizzazioni per ruolo (401/403/200) tramite token JWT.
 * Riferimento tabella test D4: TC84-TC92.
 */

const request = require('supertest');
const app = require('../app');
const { connectTestDb, closeTestDb, makeToken } = require('./helpers');
const Bivacco = require('../models/bivacco');
const ConfigAPI = require('../models/configAPI');

let stToken;     // token Supporto Tecnico
let userToken;   // token utente registrato (non autorizzato)
let bivaccoId;

beforeAll(async () => {
  await connectTestDb();
  stToken = makeToken({ discriminator: 'SupportoTecnico' });
  userToken = makeToken({ discriminator: 'UtenteRegistrato' });

  const b = await Bivacco.create({
    id: 1, nome: 'Bivacco ST',
    latitudine: 46.0, longitudine: 11.2, altitudine: 2000,
    postiLetto: 2, zona: 'Test'
  });
  bivaccoId = b._id;
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/v1/supporto/log-api — log API esterne (US38)', () => {
  test('TC84 - SupportoTecnico autorizzato -> 200', async () => {
    const res = await request(app)
      .get('/api/v1/supporto/log-api')
      .set('Authorization', `Bearer ${stToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('TC85 - utente non ST -> 403', async () => {
    const res = await request(app)
      .get('/api/v1/supporto/log-api')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('senza token -> 401', async () => {
    const res = await request(app).get('/api/v1/supporto/log-api');
    expect(res.status).toBe(401);
  });
});

describe('config-api — configurazione provider (US39)', () => {
  test('TC87 - creazione configurazione provider', async () => {
    const res = await request(app)
      .post('/api/v1/supporto/config-api')
      .set('Authorization', `Bearer ${stToken}`)
      .send({ provider: 'Open-Meteo', baseUrl: 'https://api.open-meteo.com/v1/forecast' });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('Open-Meteo');
  });

  test('TC88 - modifica configurazione esistente', async () => {
    const created = await request(app)
      .post('/api/v1/supporto/config-api')
      .set('Authorization', `Bearer ${stToken}`)
      .send({ provider: 'Mappe', baseUrl: 'http://vecchio' });

    const res = await request(app)
      .patch(`/api/v1/supporto/config-api/${created.body._id}`)
      .set('Authorization', `Bearer ${stToken}`)
      .send({ baseUrl: 'http://nuovo', enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.config.baseUrl).toBe('http://nuovo');
    expect(res.body.config.enabled).toBe(false);
  });

  test('TC89 - provider duplicato -> 409', async () => {
    await ConfigAPI.create({ id: 99, provider: 'Dup', baseUrl: 'http://x' });
    const res = await request(app)
      .post('/api/v1/supporto/config-api')
      .set('Authorization', `Bearer ${stToken}`)
      .send({ provider: 'Dup', baseUrl: 'http://y' });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/v1/supporto/bivacchi/:id — modifica bivacco (US40)', () => {
  test('TC90 - modifica dati tecnici', async () => {
    const res = await request(app)
      .patch(`/api/v1/supporto/bivacchi/${bivaccoId}`)
      .set('Authorization', `Bearer ${stToken}`)
      .send({ altitudine: 2100, dotazioni: 'stufa, 4 brande' });
    expect(res.status).toBe(200);
    expect(res.body.bivacco.altitudine).toBe(2100);
    expect(res.body.bivacco.dotazioni).toBe('stufa, 4 brande');
  });

  test('TC91 - bivacco inesistente -> 404', async () => {
    const res = await request(app)
      .patch('/api/v1/supporto/bivacchi/000000000000000000000000')
      .set('Authorization', `Bearer ${stToken}`)
      .send({ altitudine: 1000 });
    expect(res.status).toBe(404);
  });

  test('TC92 - accesso negato senza ruolo ST -> 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/supporto/bivacchi/${bivaccoId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ altitudine: 999 });
    expect(res.status).toBe(403);
  });
});
