const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let stationDatabase = {};

// Wir speichern den letzten aktiven Talker inklusive Zeitstempel
let activeTalkers = {
    "313": { station: null, details: "", timestamp: 0 }
};

const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    console.log('Verbunden mit MQTT-Broker');
    mqttClient.subscribe('#');
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        const data = JSON.parse(messageStr);
        
        // 1. Standorte aus dem Status-Stream lernen
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

        // 2. Live-PTT-Stream (Wer spricht JETZT?)
        if (data.callsign || data.talker || topic.includes('talker')) {
            let stationName = data.callsign || data.talker || "Unbekannt";
            let upperCall = stationName.toUpperCase();
            
            let detailsText = "Live-Station / Mobil";
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
            
            // Wenn es zur Talkgroup 313 gehört, aktualisieren wir den Zeitstempel auf "JETZT"
            if (topic.includes('313') || (data.tg && Number(data.tg) === 313)) {
                activeTalkers["313"] = {
                    station: stationName,
                    details: detailsText,
                    timestamp: Date.now() // Aktuelle Millisekunden
                };
            }
        }
    } catch (e) {
        // Ignorieren
    }
});

// API-Endpunkt mit automatischem Timeout (z. B. nach 8 Sekunden Inaktivität)
app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    const currentData = activeTalkers[tgId];
    
    // Prüfen, ob in den letzten 8 Sekunden ein Signal kam
    const now = Date.now();
    const timeoutLimit = 8000; // 8 Sekunden
    
    if (currentData && currentData.station && (now - currentData.timestamp < timeoutLimit)) {
        // Station ist frisch aktiv
        res.json({
            success: true,
            tg: tgId,
            data: [{
                col1: currentData.station,
                col2: currentData.details,
                col3: "🔴 Sprechend / Aktiv"
            }]
        });
    } else {
        // Keine aktuelle Aktivität mehr -> Tabelle leeren
        res.json({
            success: true,
            tg: tgId,
            data: [{
                col1: "Keine aktive Station",
                col2: "",
                col3: ""
            }]
        });
    }
});

app.listen(PORT, () => {
    console.log(`Timeout-Proxy läuft auf Port ${PORT}`);
});