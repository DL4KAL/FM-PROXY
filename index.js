const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS aktivieren, damit Ihre Haupt-Website die Daten abfragen darf
app.use(cors());

app.get('/api/tg/:tgId', async (req, res) => {
    const tgId = req.params.tgId;
    try {
        const url = `https://dashboard.fm-funknetz.de/tg.php?tg=${tgId}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Compatible; FM-Proxy/1.0)' }
        });

        const $ = cheerio.load(response.data);
        const stations = [];

        // Auslesen der Tabelleneinträge der jeweiligen Talkgroup-Seite
        $('table tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length > 0) {
                stations.push({
                    col1: $(cols[0]).text().trim(),
                    col2: $(cols[1]).text().trim(),
                    col3: $(cols[2]).text().trim()
                });
            }
        });

        res.json({ success: true, tg: tgId, data: stations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy-Server läuft auf Port ${PORT}`);
});