import Express from "express";
import http from "http";
import { createSIOServer } from "./helpers/sio";
import { config as env } from "dotenv";
import Client from "./types/client";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import createGQLResolvers from "./resolvers";
import typeDefs from "./typedefs";
import { verifyToken } from "./helpers/jwt";
import TMLogger from "./helpers/logger";
env();
const logger = new TMLogger(`STARTUP`);

async function main() {
	logger.debug(`Creating HTTP and SIO services...`);
	const app = Express();
	const server = http.createServer(app);

	// Make a new Socket.IO Server instance and bind it to the HTTP server
	const io = createSIOServer(server);

	logger.debug(`Creating backend services...`);
	// This really should not be called a Client, but whatever...
	const client = new Client({ express: app, http: server, io });

	await client.ready;

	logger.debug(`Creating GQL resolvers...`);
	const resolvers = createGQLResolvers(client);

	logger.debug(`Creating Apollo Server...`);
	const apollo = new ApolloServer({
		csrfPrevention: true,
		cache: "bounded",
		plugins: [ApolloServerPluginDrainHttpServer({ httpServer: server })],
		resolvers,
		typeDefs,
		context: async ({ req }) => {
			const token =
				req.header("Authorization") ??
				(req.cookies["authToken"] as string) ??
				"";
			const vrf = verifyToken(token);
			const user = client.userManager.get(vrf?.userId);

			return { user };
		},
	});

	logger.debug(`Starting servers, applying middleware...`);
	await apollo.start();
	apollo.applyMiddleware({ app });

	await new Promise<void>((resolve) =>
		server.listen(process.env.PORT ?? 3018, resolve)
	);
	const addr = server.address();
	if (typeof addr === 'string') throw new Error('');
	logger.info(`TrainManager ready and started!`, `Listening on ${addr.address}:${addr.port}`);
}

logger.info(`Starting TrainManager/core`);
main();
