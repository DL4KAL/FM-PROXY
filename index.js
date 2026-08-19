const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let latestTgData = {
    "313": [{ col1: "Lausche auf Broker...", col2: "Bitte auf TG 313 sprechen", col3: "" }]
};

const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    console.log('Verbunden mit FM-Funknetz MQTT-Broker');
    // Wir abonnieren pauschal alles, um zu sehen, was ankommt
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('Abonniert auf alle Topics (#)');
        }
    });
});

mqttClient.on('message', (topic, payload) => {
    const messageStr = payload.toString();
    
    // LOGGEN: Jede einzelne Nachricht im Render-Log ausgeben!
    console.log(`[MQTT Empfangen] Topic: ${topic} | Inhalt: ${messageStr.substring(C => 100)}`);

    // Wenn irgendwo "313" vorkommt, fangen wir es auf
    if (topic.includes('313') || messageStr.includes('313')) {
        latestTgData["313"] = [{ col1: topic, col2: messageStr, col3: "Live Aktiv" }];
    }
});

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