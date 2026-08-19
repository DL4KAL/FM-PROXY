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
        
        // Sobald dein Rufzeichen auftaucht, geben wir das GESAMTE Paket in den Render-Logs aus!
        if (messageStr.includes('DL4KAL')) {
            console.log('--- GEFUNDENES PAKET FÜR DL4KAL ---');
            console.log('Topic:', topic);
            console.log('Inhalt (JSON):', messageStr);
            console.log('-----------------------------------');
        }

        const data = JSON.parse(messageStr);
        
        if (data.callsign || data.talker || messageStr.includes('DL4KAL')) {
            let stationName = data.callsign || data.talker || "DL4KAL-APP";
            
            // Wir erlauben erst einmal alles, was wir übergeben bekommen, 
            // damit wir die exakten JSON-Schlüssel im Log sehen
            liveTalkers["313"] = [{
                col1: stationName,
                col2: `Bonn / JO30ms (Test-Modus)`, // Testweise fest, bis wir die echten Felder auslesen
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