const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Habilitar CORS para todas las solicitudes
app.use(cors());

// Endpoint del Proxy
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;

    if (!streamUrl) {
        return res.status(400).send('Falta la URL del stream');
    }

    try {
        // Configuramos las cabeceras para simular una petición válida desde Kick.com
        const response = await axios({
            method: 'get',
            url: streamUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://kick.com/',
                'Origin': 'https://kick.com'
            },
            responseType: 'stream' // Importante para streaming de video
        });

        // Reenviar el tipo de contenido original (video/mp4, application/x-mpegURL, etc.)
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Canalizar el stream de datos hacia la respuesta
        response.data.pipe(res);

    } catch (error) {
        console.error('Error en el proxy:', error.message);
        if (error.response) {
            res.status(error.response.status).send(error.message);
        } else {
            res.status(500).send(error.message);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor Proxy CORS corriendo en http://localhost:${PORT}`);
});
