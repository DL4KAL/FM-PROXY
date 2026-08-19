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
        const data = JSON.parse(messageStr);
        
        // Wenn das Paket Daten zu Talkern oder aktiven Stationen enthält
        if (data.callsign || data.talker || (data.satellite && data.satellite.parent_nodes)) {
            let stationName = data.callsign || data.talker || "Unbekannt";
            
            // Wir suchen im JSON nach allen gängigen Feldern für Standort und QRA-Kenner/Locator
            let location = data.Location || data.nodeLocation || data.location || "Kein Standort";
            let locator = data.Locator || data.locator || data.qra || "";
            
            let detailsText = location;
            if (locator) {
                detailsText += ` (QRA: ${locator})`;
            }
            
            if (topic.includes('313') || (data.tg && Number(data.tg) === 313) || messageStr.includes('DL4KAL')) {
                liveTalkers["313"] = [{
                    col1: stationName,
                    col2: detailsText,
                    col3: "🔴 Sprechend / Aktiv"
                }];
            }
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