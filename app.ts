import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import morgan from 'morgan';
import multer, { FileFilterCallback } from 'multer';
import os from 'os';
import Tesseract from 'tesseract.js';

//#region App Setup
const app = express();
dotenv.config({ path: './.env' });

const SWAGGER_OPTIONS = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Image-Optical-Character-Recognition',
      version: '1.0.0',
      description:
        'Scan image files and retrieve textual data embedded within.',
      contact: {
        name: 'Orji Michael',
        email: 'orjimichael4886@gmail.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development Environment',
      },
      {
        url: 'https://image-optical-character-recognition.onrender.com',
        description: 'Staging Environment',
      },
    ],
    tags: [
      {
        name: 'Default',
        description: 'Default API Operations that come inbuilt',
      },
    ],
  },
  apis: ['**/*.ts'],
};

const swaggerSpec = swaggerJSDoc(SWAGGER_OPTIONS);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(morgan('dev'));

const tempDir = os.tmpdir(); // Get the system temporary directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir); // Use the system temporary directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Keep the original file name
  },
});
// Define the file filter function with TypeScript types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    // cb(new Error('Only jpg and png files are allowed!')); // Reject file
    cb(null, false);
  }
};
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5 MB
  },
  fileFilter,
});

//#endregion

//#region Keys and Configs
const PORT = process.env.PORT || 3000;
const baseURL = 'https://httpbin.org';
//#endregion

//#region Code here

async function extractTextFromImage(imagePath: string) {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m), // Log progress messages
    });
    return text;
  } catch (error: any) {
    console.error('Error during OCR processing:', error);
    // throw Error(error.message);
    return false;
  }
}

/**
 * @swagger
 * /extract-text:
 *   post:
 *     summary: Upload an image file to extract text
 *     description: Extracts text from an uploaded image and returns it as JSON
 *     tags:
 *       - Image OCR
 *     requestBody:
 *       description: Image file to be processed
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Successfully extracted text from the image
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: string
 *       '400':
 *         description: Bad request, file not uploaded
 */

app.post(
  '/extract-text',
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).send({
        success: false,
        message: 'No file uploaded. Only jpg and png types accepted',
      });
    }

    const filePath = req.file.path;

    try {
      const extractedText = await extractTextFromImage(filePath);
      if (!extractedText)
        return res
          .status(400)
          .send({ success: false, message: 'Unknown error occured' });

      res.send({
        success: true,
        message: 'Image text extracted successfully',
        data: extractedText,
      });
    } catch (e: any) {
      return res
        .status(400)
        .send({ success: false, message: 'Unknown error occured' });
    }
  }
);

//#endregion

//#region Server Setup

// Function to ping the server itself
async function pingSelf() {
  try {
    const { data } = await axios.get(`http://localhost:5000`);
    console.log(`Server pinged successfully: ${data.message}`);
    return true;
  } catch (e: any) {
    console.error(`Error pinging server: ${e.message}`);
    return false;
  }
}

// Route for external API call
/**
 * @swagger
 * /api:
 *   get:
 *     summary: Call a demo external API (httpbin.org)
 *     description: Returns an object containing demo content
 *     tags: [Default]
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.get('/api', async (req: Request, res: Response) => {
  try {
    const result = await axios.get(baseURL);
    return res.send({
      message: 'Demo API called (httpbin.org)',
      data: result.status,
    });
  } catch (error: any) {
    console.error('Error calling external API:', error.message);
    return res.status(500).send({ error: 'Failed to call external API' });
  }
});

// Route for health check
/**
 * @swagger
 * /:
 *   get:
 *     summary: API Health check
 *     description: Returns an object containing demo content
 *     tags: [Default]
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.get('/', (req: Request, res: Response) => {
  return res.send({ message: 'API is Live!' });
});

// Middleware to handle 404 Not Found
/**
 * @swagger
 * /obviously/this/route/cant/exist:
 *   get:
 *     summary: API 404 Response
 *     description: Returns a non-crashing result when you try to run a route that doesn't exist
 *     tags: [Default]
 *     responses:
 *       '404':
 *         description: Route not found
 */
app.use((req: Request, res: Response) => {
  return res
    .status(404)
    .json({ success: false, message: 'API route does not exist' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // throw Error('This is a sample error');

  console.log(`${'\x1b[31m'}${err.message}${'\x1b][0m]'} `);

  return res
    .status(500)
    .send({ success: false, status: 500, message: err.message });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
});

// (for render services) Keep the API awake by pinging it periodically
// setInterval(pingSelf, 600000);

//#endregion
