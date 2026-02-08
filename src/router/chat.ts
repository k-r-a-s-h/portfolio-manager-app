
import express from 'express';
import { chatController } from '../controller/chat.js';

export const chatRouter = express.Router();

chatRouter.post('/', chatController);
