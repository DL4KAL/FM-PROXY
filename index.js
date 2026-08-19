const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let liveTalkers = {
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
        
        // Prüfen, ob das Paket Daten zu einer aktiven Station enthält
        if (data.callsign || data.talker || messageStr.includes('DL4KAL')) {
            let stationName = data.callsign || data.talker || "Unbekannt";
            
            // Echte Standort- und Locator-Felder aus dem JSON auslesen
            let location = data.Location || data.nodeLocation || data.location || data.city || "";
            let locator = data.Locator || data.locator || data.qra || data.grid || "";
            
            // Details zusammenbauen
            let detailsText = "Kein Standort";
            if (location && locator) {
                detailsText = `${location} / ${locator}`;
            } else if (location) {
                detailsText = location;
            } else if (locator) {
                detailsText = `QRA: ${locator}`;
            }
            
            // Wenn es Bonn/JO30ms ist, zur Sicherheit direkt sauber setzen, 
            // falls das JSON-Feld im Broker anders benannt ist:
            if (stationName.includes('DL4KAL')) {
                detailsText = "Bonn / JO30ms";
            }
            
            liveTalkers["313"] = [{
                col1: stationName,
                col2: detailsText,
                col3: "🔴 Sprechend / Aktiv"
            }];
        }
    } catch (e) {
        // Ignorieren
    }
});

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