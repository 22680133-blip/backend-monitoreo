const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const deviceController = require('../controllers/device.controller');

router.post('/', auth, deviceController.create);
router.get('/', auth, deviceController.getAll);
router.get('/:id', auth, deviceController.getOne);
router.put('/:id', auth, deviceController.update);
router.delete('/:id', auth, deviceController.remove);

module.exports = router;