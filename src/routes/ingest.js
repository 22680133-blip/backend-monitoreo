const express = require('express');
const router = express.Router();
const ingestController = require('../controllers/ingest.controller');

// Ruta pública — no requiere JWT
// Acepta device code en URL (/api/ingest/:deviceCode) o en body (device_code)
router.post(['/', '/:deviceCode'], ingestController.ingest);

module.exports = router;
