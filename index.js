const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let stationDatabase = {};
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

        // 1. Standorte aus den Node-Infos lernen
        if (topic.startsWith('/server/state/nodes/') && data.call) {
            stationDatabase[data.call.toUpperCase()] = {
                location: data.location || "",
                locator: data.locator || ""
            };
        }

        // 2. Sprachübertragung auf TG 313 (Start/Stop)
        if (topic.startsWith('/server/statethr/') && String(data.tg) === '313') {
            const stationName = data.call || "";
            const upperCall = stationName.toUpperCase();

            if (!upperCall || upperCall.includes("DL7MO-APP") || upperCall.includes("APRS")) {
                return;
            }

            if (data.talk === 'start') {
                let detailsText = "Live-Station / Mobil";
                const dbEntry = stationDatabase[upperCall];
                if (dbEntry) {
                    if (dbEntry.location && dbEntry.locator) {
                        detailsText = `${dbEntry.location} / ${dbEntry.locator}`;
                    } else if (dbEntry.location) {
                        detailsText = dbEntry.location;
                    } else if (dbEntry.locator) {
                        detailsText = `QRA: ${dbEntry.locator}`;
                    }
                }

                activeTalkers["313"] = {
                    station: stationName,
                    details: detailsText,
                    timestamp: Date.now()
                };
            } else if (data.talk === 'stop') {
                if (activeTalkers["313"].station === stationName) {
                    activeTalkers["313"] = { station: null, details: "", timestamp: 0 };
                }
            }
        }
    } catch (e) {
        // Ignorieren (z. B. Klartext-Logzeilen oder fremde Formate)
    }
});

// API-Endpunkt: Sprecher bleibt aktiv, bis das Stop-Paket kommt
app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    const currentData = activeTalkers[tgId];

    const now = Date.now();
    // Sicherheitsnetz: Nur greifen, wenn ein Stop-Paket verloren gegangen ist
    const safetyLimit = 10 * 60 * 1000; // 10 Minuten

    if (currentData && currentData.station && (now - currentData.timestamp < safetyLimit)) {
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
    console.log(`Proxy läuft auf Port ${PORT}`);
});
