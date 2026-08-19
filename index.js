const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Wir speichern hier die letzten aktiven Stationen pro Talkgroup
let liveTalkers = {
    "313": [{ col1: "Warte auf PTT / Live-Daten...", col2: "", col3: "" }]
};

// Verbindung zum FM-Funknetz MQTT Broker herstellen
const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    console.log('Verbunden mit MQTT-Broker für Live-Erfassung');
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('Abonniert auf alle Topics (#)');
        }
    });
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        
        // Wir prüfen, ob die Nachricht Daten über einen aktiven Sprecher oder Call enthält
        // Viele Dashboards senden JSON-Daten mit Feldern wie 'callsign', 'talker', 'active' etc.
        if (messageStr.includes('DL4KAL') || messageStr.includes('isTalker') || messageStr.includes('callsign')) {
            console.log(`Live-Event auf Topic ${topic}:`, messageStr);
        }

        // Versuche das JSON zu parsen, um zu sehen, ob es Live-Talker-Daten für TG 313 sind
        const data = JSON.parse(messageStr);
        
        // Wenn das Paket Daten zu Talkern oder aktiven Stationen enthält:
        if (data.callsign || data.talker || (data.satellite && data.satellite.parent_nodes)) {
            // Hier fangen wir generisch ankommende Stationen ab
            let stationName = data.callsign || data.talker || "Unbekannt";
            let location = data.Location || data.nodeLocation || "Live-Station";
            
            // Wenn die Nachricht zur TG 313 gehört oder dort aktiv ist
            if (topic.includes('313') || (data.tg && Number(data.tg) === 313)) {
                liveTalkers["313"] = [{
                    col1: stationName,
                    col2: location,
                    col3: "🔴 Sprechend / Aktiv"
                }];
            }
        }
    } catch (e) {
        // Nicht-JSON oder andere Nachrichten ignorieren
    }
});

// API-Endpunkt für deine Website
app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    res.json({
        success: true,
        tg: tgId,
        data: liveTalkers[tgId] || [{ col1: "Keine aktive Station", col2: "", col3: "" }]
    });
});

app.listen(PORT, () => {
    console.log(`Proxy-Server läuft auf Port ${PORT}`);
});