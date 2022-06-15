import { Server as SIOServer } from "socket.io";
import { Server as HTTPServer } from 'http'

function createSIOServer(http: HTTPServer): SIOServer {
	const io = new SIOServer(http, {
		cors: {
			origin: [
				"https://admin.socket.io"
			],
			credentials: true,
		},
	});

	return io;
};

export { createSIOServer };