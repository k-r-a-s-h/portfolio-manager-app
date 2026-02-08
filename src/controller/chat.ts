import type { Request, Response } from 'express';
import { processChatMessage } from '../service/chat.js';
import Logger from '../utils/logger.js';

export const chatController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;

        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        const response = await processChatMessage(message);

        res.json({ response });
    } catch (error) {
        Logger.error('Error in chat controller:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
