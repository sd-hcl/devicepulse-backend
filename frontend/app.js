const state = {
  charger: '80W',
  device1: { device: 'Vivo V30', battery: 20 },
  device2: null,
  powerbank: { enabled: false, battery: 70 },
};

const elements = {
  charger: document.getElementById('charger'),
  device1: document.getElementById('device1'),
  battery1: document.getElementById('battery1'),
  battery1Value: document.getElementById('battery1Value'),
  device2Enabled: document.getElementById('device2Enabled'),
  device2: document.getElementById('device2'),
  battery2: document.getElementById('battery2'),
  battery2Value: document.getElementById('battery2Value'),
  powerbankEnabled: document.getElementById('powerbankEnabled'),
  pbBattery: document.getElementById('pbBattery'),
  pbBatteryValue: document.getElementById('pbBatteryValue'),
  pbInputActive: document.getElementById('pbInputActive'),
  pbOutputPorts: document.getElementById('pbOutputPorts'),
  device1Card: document.getElementById('device1Card'),
  device2Card: document.getElementById('device2Card'),
  powerbankCard: document.getElementById('powerbankCard'),
  warnings: document.getElementById('warnings'),
  device1Flow: document.getElementById('device1Flow'),
  device2Flow: document.getElementById('device2Flow'),
  pbFlow: document.getElementById('pbFlow'),
  led1: document.getElementById('led1'),
  led2: document.getElementById('led2'),
  led3: document.getElementById('led3'),
  led4: document.getElementById('led4'),
};

const chartContext = document.getElementById('powerChart').getContext('2d');
const chart = new Chart(chartContext, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Total Power Draw (W)',
        borderColor: '#31c9ff',
        backgroundColor: 'rgba(49, 201, 255, 0.2)',
        data: [],
        tension: 0.35,
        fill: true,
      },
      {
        label: 'Device 1 Watt',
        borderColor: '#7cea8e',
        backgroundColor: 'rgba(126, 234, 142, 0.18)',
        data: [],
        tension: 0.35,
        fill: true,
      },
      {
        label: 'Device 2 Watt',
        borderColor: '#ff9b4c',
        backgroundColor: 'rgba(255, 155, 76, 0.18)',
        data: [],
        tension: 0.35,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#d9edf8' },
      },
    },
    scales: {
      x: { ticks: { color: '#a8c9e2' } },
      y: {
        ticks: { color: '#a8c9e2' },
        beginAtZero: true,
      },
    },
  },
});

const ws = new WebSocket(`ws://${window.location.host}`);

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'state' || message.type === 'update') {
    updateDisplay(message.data);
  }
};

ws.onclose = () => {
  console.log('Disconnected from server');
};

function updateDisplay(data) {
  // Update device1 card
  if (data.device1) {
    elements.device1Card.innerHTML = `
      <h3>Device 1: ${data.device1.device}</h3>
      <p>Battery: ${data.device1.battery.toFixed(1)}%</p>
      <p>Charging: ${data.device1.watt}W</p>
      <p>Temp: ${data.device1.temperature.toFixed(1)}°C</p>
      <p>Health: ${data.device1.batteryHealth.toFixed(1)}%</p>
      <p>ETA: ${data.device1.timeToFull} min</p>
    `;
    elements.device1Flow.textContent = `${data.device1.device}: ${data.device1.watt}W`;
  }

  // Update device2 card
  if (data.device2) {
    elements.device2Card.innerHTML = `
      <h3>Device 2: ${data.device2.device}</h3>
      <p>Battery: ${data.device2.battery.toFixed(1)}%</p>
      <p>Charging: ${data.device2.watt}W</p>
      <p>Temp: ${data.device2.temperature.toFixed(1)}°C</p>
      <p>Health: ${data.device2.batteryHealth.toFixed(1)}%</p>
      <p>ETA: ${data.device2.timeToFull} min</p>
    `;
    elements.device2Flow.textContent = `${data.device2.device}: ${data.device2.watt}W`;
  } else {
    elements.device2Card.innerHTML = '<h3>Device 2</h3><p>Disabled</p>';
    elements.device2Flow.textContent = 'Device 2: Off';
  }

  // Update powerbank card
  if (data.powerbank.enabled) {
    elements.powerbankCard.innerHTML = `
      <h3>PowerBank</h3>
      <p>Battery: ${data.powerbank.battery.toFixed(1)}%</p>
      <p>Input: ${data.powerbank.inputWatt}W</p>
      <p>Output: ${data.powerbank.outputWatt}W</p>
    `;
    elements.pbFlow.textContent = `PowerBank: ${data.powerbank.outputWatt}W`;
  } else {
    elements.powerbankCard.innerHTML = '<h3>PowerBank</h3><p>Disabled</p>';
    elements.pbFlow.textContent = 'PowerBank: Off';
  }

  // Update LEDs
  const leds = data.powerbank.leds || [false, false, false, false];
  [elements.led1, elements.led2, elements.led3, elements.led4].forEach((led, i) => {
    led.classList.toggle('active', leds[i]);
  });

  // Update chart
  const now = new Date().toLocaleTimeString();
  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(data.system.totalWatt);
  chart.data.datasets[1].data.push(data.device1.watt);
  chart.data.datasets[2].data.push(data.device2 ? data.device2.watt : 0);
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds => ds.data.shift());
  }
  chart.update();

  // Warnings
  const warnings = [...(data.device1.warnings || []), ...(data.device2?.warnings || []), ...(data.system.warnings || [])];
  elements.warnings.textContent = warnings.length ? 'Warnings: ' + warnings.join(', ') : '';
}

// Event listeners for controls
elements.charger.addEventListener('change', updateState);
elements.device1.addEventListener('change', updateState);
elements.battery1.addEventListener('input', updateState);
elements.device2Enabled.addEventListener('change', () => {
  elements.device2.disabled = !elements.device2Enabled.checked;
  elements.battery2.disabled = !elements.device2Enabled.checked;
  updateState();
});
elements.device2.addEventListener('change', updateState);
elements.battery2.addEventListener('input', updateState);
elements.powerbankEnabled.addEventListener('change', updateState);
elements.pbBattery.addEventListener('input', updateState);
elements.pbInputActive.addEventListener('change', updateState);
elements.pbOutputPorts.addEventListener('change', updateState);

function updateState() {
  state.charger = elements.charger.value;
  state.device1.device = elements.device1.value;
  state.device1.battery = parseFloat(elements.battery1.value);
  elements.battery1Value.textContent = state.device1.battery + '%';

  if (elements.device2Enabled.checked) {
    state.device2 = {
      device: elements.device2.value,
      battery: parseFloat(elements.battery2.value),
    };
    elements.battery2Value.textContent = state.device2.battery + '%';
  } else {
    state.device2 = null;
  }

  state.powerbank.enabled = elements.powerbankEnabled.checked;
  state.powerbank.battery = parseFloat(elements.pbBattery.value);
  elements.pbBatteryValue.textContent = state.powerbank.battery + '%';
  state.powerbank.inputActive = elements.pbInputActive.checked;

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'update', data: state }));
  }
}
  elements.warnings.textContent = warningText.length ? warningText.join(' • ') : 'All systems normal.';

  const now = new Date().toLocaleTimeString();
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
    chart.data.datasets[2].data.shift();
  }

  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(data.system.totalPowerDraw);
  chart.data.datasets[1].data.push(data.device1.watt);
  chart.data.datasets[2].data.push(state.device2Enabled && data.device2 ? data.device2.watt : 0);
  chart.update();
}

function readControls() {
  state.charger = elements.charger.value;
  state.device1 = elements.device1.value;
  state.battery1 = Number(elements.battery1.value);
  state.device2Enabled = elements.device2Enabled.checked;
  state.device2 = elements.device2.value;
  state.battery2 = Number(elements.battery2.value);
  state.powerbankEnabled = elements.powerbankEnabled.checked;
  state.pbBattery = Number(elements.pbBattery.value);
  state.pbInputActive = elements.pbInputActive.checked;
  state.pbOutputPorts = Number(elements.pbOutputPorts.value);
}

function applyControls() {
  elements.battery1Value.textContent = `${state.battery1}%`;
  elements.battery2Value.textContent = `${state.battery2}%`;
  elements.pbBatteryValue.textContent = `${state.pbBattery}%`;
  elements.device2.disabled = !state.device2Enabled;
  elements.battery2.disabled = !state.device2Enabled;
  elements.battery2Value.style.opacity = state.device2Enabled ? '1' : '0.4';
}

async function fetchSimulation() {
  readControls();
  applyControls();

  const payload = {
    charger: state.charger,
    device1: state.device1,
    battery1: state.battery1,
    powerbank: {
      enabled: state.powerbankEnabled,
      battery: state.pbBattery,
      inputActive: state.pbInputActive,
      outputPorts: state.pbOutputPorts,
    },
  };

  if (state.device2Enabled) {
    payload.device2 = state.device2;
    payload.battery2 = state.battery2;
  }

  try {
    const response = await fetch('/api/power/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to calculate output');
    }
    updateDisplay(data);
  } catch (error) {
    elements.warnings.textContent = error.message;
  }
}

function bindEvents() {
  const controls = [
    elements.charger,
    elements.device1,
    elements.battery1,
    elements.device2Enabled,
    elements.device2,
    elements.battery2,
    elements.powerbankEnabled,
    elements.pbBattery,
    elements.pbInputActive,
    elements.pbOutputPorts,
  ];

  controls.forEach((control) => {
    control.addEventListener('input', fetchSimulation);
    control.addEventListener('change', fetchSimulation);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  applyControls();
  fetchSimulation();
  setInterval(fetchSimulation, 2000);
});
