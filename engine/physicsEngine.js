const deviceProfiles = {
  V30: {
    name: 'Vivo V30',
    batteryCapacitymAh: 5000,
    curve: [
      { from: 0, to: 25, minW: 60, maxW: 80 },
      { from: 25, to: 50, minW: 40, maxW: 55 },
      { from: 50, to: 75, minW: 25, maxW: 40 },
      { from: 75, to: 100, minW: 10, maxW: 15 },
    ],
  },
  T2: {
    name: 'Vivo T2',
    batteryCapacitymAh: 4500,
    curve: [
      { from: 0, to: 25, minW: 35, maxW: 44 },
      { from: 25, to: 50, minW: 25, maxW: 35 },
      { from: 50, to: 75, minW: 15, maxW: 25 },
      { from: 75, to: 100, minW: 8, maxW: 12 },
    ],
  },
};

const chargerProfiles = {
  '80W': { maxW: 80 },
  '44W': { maxW: 44 },
};

const powerbankProfile = {
  maxInputW: 18,
  maxOutputW: 18,
  lowBatteryOutputW: 10,
  capacitymAh: 20000,
};

const efficiencyModel = {
  direct: 0.9,
  powerbank: 0.8,
  dualDevice: 0.7,
};

let chargeCycles = 0;

function getBatteryHealth() {
  return Math.max(0, 100 - (chargeCycles * 0.02));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function findSegment(profile, batteryPercent) {
  return profile.curve.find((segment) => batteryPercent <= segment.to) || profile.curve[profile.curve.length - 1];
}

function segmentWatt(segment, batteryPercent) {
  const range = segment.maxW - segment.minW;
  const pct = (batteryPercent - segment.from) / Math.max(1, segment.to - segment.from);
  return segment.minW + range * clamp(pct, 0, 1);
}

function detectDevice(watt, voltage, pattern) {
  if (watt >= 44) return 'V30';
  if (watt >= 18 && watt <= 44) return 'T2';
  if (watt <= 18) return 'PowerBank';
  return 'Unknown';
}

function computeDeviceState(deviceKey, batteryPercent, availableW, efficiencyPercent, activeConfig) {
  const profile = deviceProfiles[deviceKey];
  if (!profile) {
    throw new Error(`Unsupported device: ${deviceKey}`);
  }
  const warn = [];

  if (batteryPercent >= 100) {
    return {
      device: profile.name,
      voltage: 5,
      current: 0,
      watt: 0,
      efficiency: efficiencyPercent,
      batteryHealth: getBatteryHealth(),
      timeToFull: 0,
      warnings: warn,
      temperature: 25 + Math.random() * 10,
    };
  }

  const segment = findSegment(profile, batteryPercent);
  const idealWatt = segmentWatt(segment, batteryPercent);
  const watt = parseFloat(clamp(idealWatt, 0, availableW).toFixed(2));
  const voltage = 9;
  const current = parseFloat((watt / Math.max(voltage, 0.0001)).toFixed(2));

  if (watt < idealWatt * 0.95) {
    warn.push('FlashCharge inactive');
  }

  if (activeConfig?.powerbank && watt < availableW) {
    warn.push('Powerbank limiting output');
  }

  const batteryWh = (profile.batteryCapacitymAh / 1000) * 3.85;
  const remainingWh = batteryWh * ((100 - batteryPercent) / 100);
  const timeToFull = watt > 0 ? Math.round((remainingWh / watt) * 60) : 0;

  return {
    device: profile.name,
    voltage,
    current,
    watt,
    efficiency: efficiencyPercent,
    batteryHealth: getBatteryHealth(),
    timeToFull,
    warnings: warn,
    temperature: 25 + Math.random() * 10,
  };
}

function calculateCharging({ charger, device1, battery1, device2, battery2, powerbank }) {
  const chargerMaxW = chargerProfiles[charger]?.maxW || 80;
  let availableW = chargerMaxW;
  const systemWarnings = [];

  let pbInputW = 0;
  let pbOutputW = 0;
  let pbBattery = powerbank?.battery || 100;
  let pbEfficiency = efficiencyModel.powerbank;

  if (powerbank?.enabled) {
    if (powerbank.inputActive) {
      pbInputW = Math.min(powerbankProfile.maxInputW, availableW);
      availableW -= pbInputW;
      pbBattery = Math.min(100, pbBattery + (pbInputW * pbEfficiency / 10));
    }
    const pbMaxOut = pbBattery > 20 ? powerbankProfile.maxOutputW : powerbankProfile.lowBatteryOutputW;
    pbOutputW = Math.min(pbMaxOut, availableW + pbInputW);
    availableW = pbOutputW;
  }

  const efficiency = powerbank?.enabled ? (device2 ? efficiencyModel.dualDevice : efficiencyModel.powerbank) : efficiencyModel.direct;

  const device1State = computeDeviceState(device1, battery1, availableW, efficiency * 100, { powerbank: powerbank?.enabled });

  let device2State = null;
  if (device2 && battery2 !== undefined) {
    const remainingW = availableW - device1State.watt;
    device2State = computeDeviceState(device2, battery2, remainingW, efficiency * 100, { powerbank: powerbank?.enabled });
  }

  const totalWatt = device1State.watt + (device2State?.watt || 0);

  if (totalWatt > 0) chargeCycles += 0.001;

  const leds = getPowerbankLeds(pbBattery);

  return {
    device1: device1State,
    device2: device2State,
    powerbank: {
      enabled: powerbank?.enabled || false,
      battery: pbBattery,
      inputWatt: pbInputW,
      outputWatt: pbOutputW,
      efficiency: pbEfficiency * 100,
      leds,
    },
    system: {
      totalWatt,
      availableW,
      efficiency: efficiency * 100,
      warnings: systemWarnings,
    },
  };
}

function getPowerbankLeds(batteryPercent) {
  if (batteryPercent <= 25) return [true, false, false, false];
  if (batteryPercent <= 50) return [true, true, false, false];
  if (batteryPercent <= 75) return [true, true, true, false];
  return [true, true, true, true];
}

function simulateStep(currentState) {
  const drainRate = 0.1;
  if (currentState.device1) {
    currentState.device1.battery = Math.min(100, currentState.device1.battery + (currentState.device1.watt / 100));
  }
  if (currentState.device2) {
    currentState.device2.battery = Math.min(100, currentState.device2.battery + (currentState.device2.watt / 100));
  }
  if (currentState.powerbank.enabled) {
    currentState.powerbank.battery = Math.max(0, currentState.powerbank.battery - drainRate);
  }
  return calculateCharging({
    charger: currentState.charger,
    device1: currentState.device1.device.toLowerCase().replace('vivo ', '').toUpperCase(),
    battery1: currentState.device1.battery,
    device2: currentState.device2 ? currentState.device2.device.toLowerCase().replace('vivo ', '').toUpperCase() : null,
    battery2: currentState.device2 ? currentState.device2.battery : null,
    powerbank: currentState.powerbank,
  });
}

module.exports = {
  calculateCharging,
  simulateStep,
  detectDevice,
  getBatteryHealth,
};