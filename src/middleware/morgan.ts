import morgan, { type StreamOptions } from 'morgan';
import Logger from '../utils/logger.js';

const stream: StreamOptions = {
    write: (message) => Logger.http(message.trim()),
};

const skip = () => {
    const env = process.env.NODE_ENV || 'development';
    return env !== 'development';
};

const morganMiddleware = morgan(
    'dev',
    { stream, skip }
);

export default morganMiddleware;
