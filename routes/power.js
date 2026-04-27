const express = require('express');
const { calculateCharging } = require('../engine/physicsEngine');

const router = express.Router();
const supportedDevices = ['V30', 'T2'];
const supportedChargers = ['80W', '44W'];

function isValidBattery(value) {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

router.post('/calculate', (req, res, next) => {
  try {
    const { charger, device1, battery1, device2, battery2, powerbank } = req.body;

    if (!supportedChargers.includes(charger)) {
      return res.status(400).json({ error: 'Invalid charger; use "80W" or "44W"' });
    }

    if (!supportedDevices.includes(device1) || !isValidBattery(battery1)) {
      return res.status(400).json({ error: 'Invalid device1 or battery1; device1 must be V30/T2 and battery1 must be 0-100' });
    }

    if (device2 && (!supportedDevices.includes(device2) || !isValidBattery(battery2))) {
      return res.status(400).json({ error: 'Invalid device2 or battery2; device2 must be V30/T2 and battery2 must be 0-100' });
    }

    const normalizedPowerbank = {
      enabled: Boolean(powerbank && powerbank.enabled === true),
      battery: typeof powerbank?.battery === 'number' ? powerbank.battery : 100,
      inputActive: Boolean(powerbank && powerbank.inputActive === true),
      outputPorts: Number(powerbank?.outputPorts || 1),
    };

    const result = calculateCharging({ charger, device1, battery1, device2, battery2, powerbank: normalizedPowerbank });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
