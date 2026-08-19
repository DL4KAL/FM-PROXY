const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let allNodesData = [];

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
        
        if (topic.includes('status') && messageStr.includes('nodes')) {
            const data = JSON.parse(messageStr);
            
            if (data.satellite && data.satellite.parent_nodes) {
                allNodesData = data.satellite.parent_nodes;
            }
        }
    } catch (e) {
        // Fehler ignorieren
    }
});

// API-Endpunkt, der nach der Talkgroup filtert
app.get('/api/tg/:tgId', (req, res) => {
    const requestedTg = parseInt(req.params.tgId, 10);
    
    // Filtere nur die Nodes heraus, die genau auf dieser Talkgroup sind
    const filteredNodes = allNodesData
        .filter(node => node.tg === requestedTg)
        .map(node => ({
            col1: node.callsign || 'Unbekannt',
            col2: node.Location || node.nodeLocation || 'Kein Standort',
            col3: `SysOp: ${node.SysOp || node.Sysop || 'N/A'}`
        }));

    res.json({
        success: true,
        tg: req.params.tgId,
        data: filteredNodes.length > 0 ? filteredNodes : [{ col1: `Keine Stationen auf TG ${requestedTg}`, col2: "", col3: "" }]
    });
});

app.listen(PORT, () => {
    console.log(`Proxy-Server läuft auf Port ${PORT}`);
});