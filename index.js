const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Wir speichern die letzten empfangenen Daten im Arbeitsspeicher
let latestTgData = {
    "313": [{ col1: "Warte auf MQTT-Daten...", col2: "", col3: "" }]
};

// Verbindung zum FM-Funknetz MQTT Broker herstellen 
// (Beispiel-Broker, falls öffentlich erreichbar - alternativ nutzen wir den Web-Scraper als Fallback)
const mqttClient = mqtt.connect('mqtt://broker.fm-funknetz.de'); // Falls der Broker anders heißt, passen wir ihn an

mqttClient.on('connect', () => {
    console.log('Verbunden mit FM-Funknetz MQTT-Broker');
    // Talkgroup 313 abonnieren (Topic-Struktur musss ggf. angepasst werden)
    mqttClient.subscribe('fm/tg/313', (err) => {
        if (!err) {
            console.log('Erfolgreich auf TG 313 abonniert');
        }
    });
});

mqttClient.on('message', (topic, payload) => {
    // Wenn Daten vom Funknetz reinkommen, speichern wir sie
    try {
        const data = JSON.parse(payload.toString());
        latestTgData["313"] = data;
    } catch (e) {
        console.log('Fehler beim Parsen der MQTT-Nachricht:', e);
    }
});

// API-Endpunkt für deine Website
app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    const data = latestTgData[tgId] || [{ col1: "Keine Aktivität", col2: "", col3: "" }];
    
    res.json({
        success: true,
        tg: tgId,
        data: data
    });
});

app.listen(PORT, () => {
    console.log(`MQTT-Proxy läuft auf Port ${PORT}`);
});