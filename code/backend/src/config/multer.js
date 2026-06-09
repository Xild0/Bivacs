/**
 * @file multer.js
 * @description Configurazione Multer per upload immagini delle segnalazioni.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/segnalazioni');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Strategia di persistenza dei file caricati tramite Multer.
 *
 * @type {import('multer').StorageEngine}
 */

const storage = multer.diskStorage({
  /**
   * Determina la cartella di destinazione del file caricato.
   *
   * @param {import('express').Request} req
   * @param {Express.Multer.File} file
   * @param {Function} cb
   * @returns {void}
   */
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  /**
   * Genera un nome univoco per il file caricato.
   *
   * @param {import('express').Request} req
   * @param {Express.Multer.File} file
   * @param {Function} cb
   * @returns {void}
   */
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

/**
 * Consente esclusivamente immagini JPG, PNG e WEBP.
 *
 * @param {import('express').Request} req
 * @param {Express.Multer.File} file
 * @param {Function} cb
 */

const fileFilter = function (req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato immagine non valido. Usa JPG, PNG o WEBP.'));
  }
};

/**
 * Istanza Multer configurata per l'upload delle immagini
 * associate alle segnalazioni.
 *
 * Limite massimo file: 5 MB.
 *
 * @type {import('multer').Multer}
 */

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = upload;