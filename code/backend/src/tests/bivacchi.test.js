/**
 * @file bivacchi.test.js
 * @description Test di integrazione per gli endpoint pubblici dei bivacchi.
 * Copre US06-US11 (Black-Box: Equivalence Partitioning, Boundary Value Analysis).
 * Riferimento tabella test D3: TC16-TC34.
 */

const request = require('supertest');
const app = require('../app');
const { connectTestDb, closeTestDb } = require('./helpers');
const Bivacco = require('../models/bivacco');

beforeAll(async () => {
  await connectTestDb();
  await Bivacco.create([
    {
      id: 1, nome: 'Bivacco Test Vigolana',
      latitudine: 46.0, longitudine: 11.2, altitudine: 1800,
      postiLetto: 4, zona: 'Vigolana', tipoStruttura: 'fisso'
    },
    {
      id: 2, nome: 'Bivacco Adamello',
      latitudine: 46.2, longitudine: 10.5, altitudine: 2500,
      postiLetto: 8, zona: 'Adamello', tipoStruttura: 'invernale'
    }
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/v1/bivacchi — lista, ricerca, filtri (US06-US10)', () => {
  test('TC18 - lista bivacchi', async () => {
    const res = await request(app).get('/api/v1/bivacchi');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test('TC19 - ricerca per nome (parziale, case-insensitive)', async () => {
    const res = await request(app).get('/api/v1/bivacchi?nome=vigolana');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].zona).toBe('Vigolana');
  });

  test('TC20 - ricerca senza risultati -> array vuoto', async () => {
    const res = await request(app).get('/api/v1/bivacchi?nome=xyz999');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('TC21 - range altitudine (Boundary Value Analysis)', async () => {
    const res = await request(app).get('/api/v1/bivacchi?altitudineMin=1500&altitudineMax=2000');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].altitudine).toBe(1800);
  });

  test('TC22 - solo altitudine minima ($gte)', async () => {
    const res = await request(app).get('/api/v1/bivacchi?altitudineMin=2000');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].altitudine).toBe(2500);
  });

  test('TC25 - filtro zona esistente', async () => {
    const res = await request(app).get('/api/v1/bivacchi?zona=Adamello');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('TC27 - filtro zona inesistente -> array vuoto', async () => {
    const res = await request(app).get('/api/v1/bivacchi?zona=Patagonia');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('TC28 - filtro posti letto >= 4', async () => {
    const res = await request(app).get('/api/v1/bivacchi?postiLetto=4');
    expect(res.status).toBe(200);
    expect(res.body.every(b => b.postiLetto >= 4)).toBe(true);
  });
});

describe('GET /api/v1/bivacchi/:id — scheda (US11)', () => {
  let id;

  beforeAll(async () => {
    id = (await Bivacco.findOne({ id: 1 }))._id;
  });

  test('TC32 - scheda bivacco esistente', async () => {
    const res = await request(app).get(`/api/v1/bivacchi/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.bivacco.nome).toBe('Bivacco Test Vigolana');
    expect(res.body).toHaveProperty('risorse');
    expect(res.body).toHaveProperty('ticketManutenzione');
  });

  test('TC33 - bivacco inesistente -> 404', async () => {
    const res = await request(app).get('/api/v1/bivacchi/000000000000000000000000');
    expect(res.status).toBe(404);
  });

  test('TC34 - id malformato -> 400 (CastError)', async () => {
    const res = await request(app).get('/api/v1/bivacchi/abc');
    expect(res.status).toBe(400);
  });
});
