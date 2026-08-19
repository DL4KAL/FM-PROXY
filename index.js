const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Hier speichern wir die geparsten Node-Daten
let parsedNodes = [];

// Verbindung zum FM-Funknetz MQTT Broker herstellen
const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    console.log('Verbunden mit FM-Funknetz MQTT-Broker');
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('Abonniert auf alle Topics');
        }
    });
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        
        // Wir suchen gezielt nach dem Reflektor-Status-JSON
        if (topic.includes('status') && messageStr.includes('nodes')) {
            const data = JSON.parse(messageStr);
            
            if (data.satellite && data.satellite.parent_nodes) {
                parsedNodes = data.satellite.parent_nodes.map(node => ({
                    col1: node.callsign || 'Unbekannt',
                    col2: node.Location || node.nodeLocation || 'Kein Standort',
                    col3: `TG: ${node.tg} | SysOp: ${node.SysOp || 'N/A'}`
                }));
            }
        }
    } catch (e) {
        // Ignorieren von Parse-Fehlern bei Nicht-JSON Nachrichten
    }
});

// API-Endpunkt für Ihre Website
app.get('/api/tg/:tgId', (req, res) => {
    res.json({
        success: true,
        tg: req.params.tgId,
        data: parsedNodes.length > 0 ? parsedNodes : [{ col1: "Warte auf Status-Daten...", col2: "", col3: "" }]
    });
});

app.listen(PORT, () => {
    console.log(`Proxy-Server läuft auf Port ${PORT}`);
});