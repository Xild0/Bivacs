/**
 * @file creaSupportoTecnico.js
 * @description Script di bootstrap per creare un account Supporto Tecnico iniziale.
 * Carica le variabili d'ambiente, si collega a MongoDB e crea l'utente tecnico
 * solo se non esiste già un account con la stessa email.
 *
 * Uso: node src/scripts/creaSupportoTecnico.js
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const SupportoTecnico = require('../models/supportoTecnico');
const getNextSequence = require('../utils/getNewSequence');

/**
 * Crea l'account Supporto Tecnico iniziale, se non già presente.
 *
 * @returns {Promise<void>}
 */
async function main() {
  await connectDB();

  const email = process.env.SUPPORTO_TECNICO_EMAIL || 'noreply.bivacs@gmail.com';
  const password = process.env.SUPPORTO_TECNICO_PASSWORD || 'Bivacs2026!';
  const matricola = process.env.SUPPORTO_TECNICO_MATRICOLA || 'ST-ADMIN';

  const esistente = await SupportoTecnico.findOne({ email });

  if (esistente) {
    console.log('Supporto Tecnico già esistente');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = await getNextSequence('utenteId');

  await SupportoTecnico.create({
    id,
    email,
    passwordHash,
    discriminator: 'SupportoTecnico',
    isVerified: true,
    matricola
  });

  console.log('Creato account Supporto Tecnico iniziale');
  console.log('email:', email);
  console.log('password:', password);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});