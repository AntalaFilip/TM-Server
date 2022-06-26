import { Server as SIOServer } from "socket.io";
import { Server as HTTPServer } from 'http';
import { instrument } from '@socket.io/admin-ui';
import bcrypt from 'bcrypt';

const servers: Array<SIOServer> = [];

function createSIOServer(http: HTTPServer): SIOServer {
	const io = new SIOServer(http, {
		cors: {
			origin: [
				"https://admin.socket.io"
			],
			credentials: true,
		},
	});
	instrument(io, {
		auth: {
			username: 'administrator',
			password: bcrypt.hashSync(process.env.SIO_ADMIN_PWD ?? 'admin123', 10),
			type: 'basic',
		}
	});

	servers.push(io);
	return io;
};

export { createSIOServer, servers };