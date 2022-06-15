import Express from 'express';
import http from 'http';
import { createSIOServer } from './helpers/sio';
import { config as env } from 'dotenv';
import { join } from 'path';
env();

const app = Express();
// TODO: add config for custom port
const server = http.createServer(app).listen(3018);

// Make a new Socket.IO Server instance and bind it to the HTTP server
const io = createSIOServer(server);
