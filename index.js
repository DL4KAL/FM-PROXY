const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Interne Datenbank für Standorte, die wir aus dem Status-Stream lernen
let stationDatabase = {};

// Hier speichern wir die aktuell sprechende Station pro Talkgroup
let currentTalkers = {
    "313": [{ col1: "Warte auf PTT / Live-Daten...", col2: "", col3: "" }]
};

const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    console.log('Verbunden mit MQTT-Broker');
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('Abonniert auf alle Topics');
        }
    });
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        const data = JSON.parse(messageStr);
        
        // QUELLE 1: Server-Status-Stream (Dient als Nachschlagewerk für Standorte & Locators)
        if (topic.includes('status') && data.satellite && data.satellite.parent_nodes) {
            data.satellite.parent_nodes.forEach(node => {
                if (node.callsign) {
                    let loc = node.Location || node.nodeLocation || node.city || "";
                    let grid = node.Locator || node.locator || node.qra || "";
                    stationDatabase[node.callsign.toUpperCase()] = {
                        location: loc,
                        locator: grid
                    };
                }
            });
        }

        // QUELLE 2: Live-PTT-Stream (Wer spricht gerade?)
        if (data.callsign || data.talker || topic.includes('talker')) {
            let stationName = data.callsign || data.talker || "Unbekannt";
            let upperCall = stationName.toUpperCase();
            
            let detailsText = "Live-Station / Mobil";
            
            // Prüfen, ob wir für dieses Rufzeichen in unserer Datenbank einen Standort/Locator haben
            if (stationDatabase[upperCall]) {
                let dbEntry = stationDatabase[upperCall];
                if (dbEntry.location && dbEntry.locator) {
                    detailsText = `${dbEntry.location} / ${dbEntry.locator}`;
                } else if (dbEntry.location) {
                    detailsText = dbEntry.location;
                } else if (dbEntry.locator) {
                    detailsText = `QRA: ${dbEntry.locator}`;
                }
            }
            
            // Wenn es zur Talkgroup 313 gehört
            if (topic.includes('313') || (data.tg && Number(data.tg) === 313)) {
                currentTalkers["313"] = [{
                    col1: stationName,
                    col2: detailsText,
                    col3: "🔴 Sprechend / Aktiv"
                }];
            }
        }
    } catch (e) {
        // Ignorieren von Parse-Fehlern bei Nicht-JSON
    }
});

app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    res.json({
        success: true,
        tg: tgId,
        data: currentTalkers[tgId] || [{ col1: "Keine aktive Station", col2: "", col3: "" }]
    });
});

app.listen(PORT, () => {
    console.log(`Intelligenter Proxy läuft auf Port ${PORT}`);
});