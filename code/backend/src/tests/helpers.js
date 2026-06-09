/**
 * @file helpers.js
 * @description Utility condivise per i test: connessione a un MongoDB in-memory
 * isolato, chiusura, generazione token JWT per i ruoli e lettura dei file GPX
 * reali presenti in uploads/gpx.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-bivacs';

let mongod = null;

/**
 * Avvia un MongoDB in-memory e vi connette Mongoose.
 * @returns {Promise<void>}
 */
async function connectTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

/**
 * Chiude la connessione e arresta il MongoDB in-memory.
 * @returns {Promise<void>}
 */
async function closeTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
  }
}

/**
 * Genera un token JWT valido coerente col payload atteso da protectRoute.
 * @param {Object} [opts]
 * @param {number} [opts.id=1]
 * @param {string} [opts.mongoId]
 * @param {string} [opts.discriminator='UtenteRegistrato']
 * @returns {string}
 */
function makeToken({ id = 1, mongoId, discriminator = 'UtenteRegistrato' } = {}) {
  return jwt.sign(
    {
      id,
      mongoId: mongoId ? String(mongoId) : new mongoose.Types.ObjectId().toString(),
      discriminator
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Percorso assoluto della cartella dei GPX reali (uploads/gpx).
 * @returns {string}
 */
function gpxDir() {
  return path.resolve(__dirname, '../../uploads/gpx');
}

/**
 * Elenca i file .gpx reali presenti in uploads/gpx.
 * @returns {string[]} Nomi dei file (vuoto se la cartella non esiste).
 */
function listGpxFiles() {
  try {
    return fs.readdirSync(gpxDir()).filter(f => f.toLowerCase().endsWith('.gpx'));
  } catch {
    return [];
  }
}

/**
 * Legge il contenuto testuale di un file GPX.
 * @param {string} file - Nome del file in uploads/gpx.
 * @returns {string}
 */
function readGpx(file) {
  return fs.readFileSync(path.join(gpxDir(), file), 'utf8');
}

/**
 * Estrae i punti (lat, lon) da un file GPX, con campionamento per limitare il carico.
 * @param {string} file
 * @param {number} [maxPoints=300]
 * @returns {Array<{lat:number, lon:number}>}
 */
function gpxPoints(file, maxPoints = 300) {
  const xml = readGpx(file);
  const re = /lat="([-0-9.]+)"\s+lon="([-0-9.]+)"/g;
  const pts = [];
  let m;
  while ((m = re.exec(xml)) && pts.length < maxPoints) {
    pts.push({ lat: Number(m[1]), lon: Number(m[2]) });
  }
  return pts;
}

module.exports = {
  connectTestDb,
  closeTestDb,
  makeToken,
  gpxDir,
  listGpxFiles,
  readGpx,
  gpxPoints
};
