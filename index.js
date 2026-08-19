const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let liveTalkers = {
    "313": [{ col1: "Warte auf PTT...", col2: "", col3: "" }]
};

const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    mqttClient.subscribe('#');
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        const data = JSON.parse(messageStr);
        
        // Prüfen, ob das Paket eine aktive Station enthält (PTT Ereignis)
        // Wir suchen nach Feldern wie callsign, talker, oder PTT-Events
        if (data.callsign || data.talker || topic.includes('talker')) {
            
            // 1. Callsign/Name extrahieren
            let stationName = data.callsign || data.talker || "Unbekannt";
            
            // 2. Intelligente Suche nach Standort & Locator
            // Wir prüfen alle gängigen Felder, die das FM-Funknetz verwendet
            let location = data.Location || data.city || data.nodeLocation || data.loc || "Kein Standort";
            let locator = data.Locator || data.grid || data.qra || data.loc_id || "";
            
            // 3. Details zusammenbauen
            let details = location;
            if (locator) {
                // Wenn ein Locator gefunden wurde, hängen wir ihn in Klammern an
                details += ` / ${locator}`;
            }
            
            // Nur aktualisieren, wenn es für die Talkgroup relevant ist
            if (topic.includes('313') || (data.tg && data.tg === 313)) {
                liveTalkers["313"] = [{
                    col1: stationName,
                    col2: details,
                    col3: "🔴 Sprechend / Aktiv"
                }];
            }
        }
    } catch (e) {
        // Nicht-JSON Pakete ignorieren
    }
});

app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    res.json({
        success: true,
        tg: tgId,
        data: liveTalkers[tgId]
    });
});

app.listen(PORT, () => {
    console.log(`Proxy läuft`);
});