const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

let liveTalkers = {
    "313": [{ col1: "Warte auf PTT...", col2: "Warte auf Daten", col3: "" }]
};

const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    mqttClient.subscribe('#');
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        const data = JSON.parse(messageStr);
        
        // Sobald du sprichst (DL4KAL), drucken wir das GESAMTE JSON in die Render-Logs!
        if (messageStr.includes('DL4KAL')) {
            console.log('=== VOLLSTÄNDIGES JSON FÜR DL4KAL ===');
            console.log(JSON.stringify(data, null, 2));
            console.log('=====================================');
        }
        
        if (data.callsign || data.talker || topic.includes('talker')) {
            let stationName = data.callsign || data.talker || "Unbekannt";
            
            // Vorübergehend geben wir das gesamte Objekt als JSON-String aus, 
            // damit wir im Browser sofort sehen, wo Bonn und JO30ms versteckt sind
            let details = JSON.stringify(data);
            
            if (topic.includes('313') || (data.tg && data.tg === 313) || messageStr.includes('DL4KAL')) {
                liveTalkers["313"] = [{
                    col1: stationName,
                    col2: details, // Hier sehen wir jetzt roh alle Felder!
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
        data: liveTalkers[tgId]
    });
});

app.listen(PORT, () => {
    console.log(`Proxy läuft`);
});