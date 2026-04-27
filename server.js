const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const { calculateCharging, simulateStep } = require('./engine/physicsEngine');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const powerRouter = require('./routes/power');
app.use('/api/power', powerRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log('Server running on port', port);
});

// WebSocket server attached to the same server
const wss = new WebSocket.Server({ server });

let currentState = {
  charger: '80W',
  device1: { device: 'Vivo V30', battery: 20 },
  device2: null,
  powerbank: { enabled: false, battery: 70 },
};

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'state', data: currentState }));

  ws.on('message', (message) => {
    try {
      const update = JSON.parse(message);
      if (update.type === 'update') {
        currentState = { ...currentState, ...update.data };
        const result = calculateCharging({
          charger: currentState.charger,
          device1: currentState.device1.device.toLowerCase().replace('vivo ', '').toUpperCase(),
          battery1: currentState.device1.battery,
          device2: currentState.device2 ? currentState.device2.device.toLowerCase().replace('vivo ', '').toUpperCase() : null,
          battery2: currentState.device2 ? currentState.device2.battery : null,
          powerbank: currentState.powerbank,
        });
        currentState = {
          charger: currentState.charger,
          device1: { ...currentState.device1, ...result.device1 },
          device2: result.device2 ? { ...currentState.device2, ...result.device2 } : null,
          powerbank: { ...currentState.powerbank, ...result.powerbank },
          system: result.system,
        };
        broadcast({ type: 'state', data: currentState });
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Real-time simulation loop
setInterval(() => {
  currentState = simulateStep(currentState);
  broadcast({ type: 'update', data: currentState });
}, 1000);
