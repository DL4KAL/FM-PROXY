const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Hier speichern wir die Live-Daten der aktiven Stationen pro TG
let activeTalkers = {
    "313": []
};

// Verbindung zum FM-Funknetz MQTT Broker herstellen
const mqttClient = mqtt.connect('mqtt://dashboard.fm-funknetz.de');

mqttClient.on('connect', () => {
    console.log('Verbunden mit FM-Funknetz MQTT-Broker für Live-Talker');
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('Abonniert auf alle MQTT-Topics');
        }
    });
});

mqttClient.on('message', (topic, payload) => {
    try {
        const messageStr = payload.toString();
        const data = JSON.parse(messageStr);

        // Wir prüfen, ob das Paket Informationen über aktive Sprecher (Talker) oder Nodes enthält
        // Viele Reflektoren senden Live-Events, wenn jemand die PTT drückt oder aktiv ist
        if (messageStr.includes('isTalker') || messageStr.includes('talker') || topic.includes('talker')) {
            console.log('Live-Aktivität entdeckt:', topic, messageStr);
        }

        // Wenn es das Status-JSON ist, filtern wir nach Knoten, die aktuell auf TG 313 funken oder aktiv sind
        if (topic.includes('status') && data.satellite && data.satellite.parent_nodes) {
            const nodesOn313 = data.satellite.parent_nodes.filter(node => node.tg === 313 || node.isTalker === true);
            
            if (nodesOn313.length > 0) {
                activeTalkers["313"] = nodesOn313.map(node => ({
                    col1: node.callsign || 'Unbekannt',
                    col2: `${node.Location || node.nodeLocation || 'Kein Standort'} (QRA: ${node.Locator || 'N/A'})`,
                    col3: node.isTalker ? '🔴 SÄNDET JETZT' : `TG: ${node.tg} | SysOp: ${node.SysOp || node.Sysop || 'N/A'}`
                }));
            }
        }
    } catch (e) {
        // Ignorieren, wenn Nachrichten kein JSON sind
    }
});

// API-Endpunkt für Ihre Website
app.get('/api/tg/:tgId', (req, res) => {
    const tgId = req.params.tgId;
    const data = activeTalkers[tgId] || [{ col1: "Keine aktive Station", col2: "", col3: "" }];

    res.json({
        success: true,
        tg: tgId,
        data: data
    });
});

app.listen(PORT, () => {
    console.log(`Live-Talker-Proxy läuft auf Port ${PORT}`);
});