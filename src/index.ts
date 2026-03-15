import dotenv from 'dotenv'
import fs from 'fs';

import express, { type Request, type Response } from 'express';
import { chatRouter } from './router/chat.js';
import { ingestRouter } from './router/ingest.js';
import Logger from './utils/logger.js';
import morganMiddleware from './middleware/morgan.js';

dotenv.config();

// Ensure the uploads directory exists for multer
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const app = express();
const port = process.env.PORT || 3000;

app.use(morganMiddleware);
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send(`Portfolio Manager App API is running at ${port}`);
});

app.use('/chat', chatRouter);
app.use('/ingest', ingestRouter);

app.listen(port, () => {
    Logger.info(`Server is running at http://localhost:${port}`);
}).on('error', (err) => {
    // TODO: Add proper error handling
    Logger.error('Error in server startup:', err);
});
