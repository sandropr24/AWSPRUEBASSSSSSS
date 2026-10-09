require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");

// 1. Clientes y Comandos de AWS SDK v3
const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");

// 2. Mocks con aws-sdk-client-mock (Pruebas / Floci)
const { mockClient } = require("aws-sdk-client-mock");

// Mock de Rekognition
const rekognitionMock = mockClient(RekognitionClient);
rekognitionMock.on(DetectLabelsCommand).resolves({
  Labels: [
    { Name: 'Hombre', Confidence: 99.4 },
    { Name: 'Niño', Confidence: 94.4 },
    { Name: 'Mujer', Confidence: 92.4 },
    { Name: 'Niña', Confidence: 91.4 }
  ]
});

// Mock de Textract
const textractMock = mockClient(TextractClient);
textractMock.on(DetectDocumentTextCommand).resolves({
  Blocks: [
    {
      BlockType: "LINE",
      Text: "flocy",
      Confidence: 99.9
    }
  ]
});
// Fin de la configuración del Mock

const app = express();
const port = process.env.PORT || 3000;

// 3. Inicialización de clientes de AWS
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
};

const rekognitionClient = new RekognitionClient(awsConfig);
const textractClient = new TextractClient(awsConfig);

// 4. Configuración de Multer (Almacenamiento en memoria + Límite de 5 MB)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // Límite máximo de 5MB
});

// 5. Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- RUTA 1: AWS Rekognition (Imágenes) ---
app.post('/api/analizar', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se adjuntó una imagen válida' });
    }

    const imageBuffer = req.file.buffer;

    const params = {
      Image: { Bytes: imageBuffer },
      MaxLabels: 10,
      MinConfidence: 75
    };

    const command = new DetectLabelsCommand(params);
    const response = await rekognitionClient.send(command);

    res.json({
      success: true,
      labels: response.Labels
    });

  } catch (error) {
    console.error(`Error en el servicio AWS Rekognition:`, error);
    res.status(500).json({
      error: 'No se concretó el análisis en AWS Rekognition',
      details: error.message,
      code: error.name
    });
  }
});

// AWS Textract ---
app.post('/api/analizar-documento', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se adjuntó un archivo PDF válido' });
    }

    const pdfBuffer = req.file.buffer;

    const params = {
      Document: { Bytes: pdfBuffer }
    };

    const command = new DetectDocumentTextCommand(params);
    const response = await textractClient.send(command);

    res.json({
      success: true,
      blocks: response.Blocks
    });

  } catch (error) {
    console.error(`Error en el servicio AWS Textract:`, error);
    res.status(500).json({
      error: 'No se concretó el análisis en AWS Textract',
      details: error.message,
      code: error.name
    });
  }
});

// 6. Iniciar el servidor web
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});