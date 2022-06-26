import Express from 'express';
import http from 'http';
import { createSIOServer } from './helpers/sio';
import { config as env } from 'dotenv';
import Client from './types/client';
env();

async function main() {
	const app = Express();
	const server = http.createServer(app);

	// Make a new Socket.IO Server instance and bind it to the HTTP server
	const io = createSIOServer(server);

	console.log('Setting up backend...');
	// This really should not be called a Client, but whatever...
	const client = new Client({ express: app, http: server, io });

	await client.ready;

	server.listen(process.env.PORT ?? 3018, () => console.log('Server listening!'));
}

main();