import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { unwrapResolverError } from "@apollo/server/errors";
import cors from "cors";
import dotenv from "dotenv";
import express, { json } from "express";
import http from "http";
import path from "path";
import {
	createSIOServer,
	GQLContext,
	Manager,
	resolvers,
	TMError,
	TMLogger,
	typeDefs,
	verifyToken,
} from "./internal";

const envPath = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envPath) });

const logger = new TMLogger(`STARTUP`);

async function main() {
	logger.debug(`Creating HTTP and WS/SIO services...`);
	const app = express();
	app.use(
		cors({
			origin: [
				"http://localhost:3000",
				"https://studio.apollographql.com",
			],
		})
	);
	const server = http.createServer(app);

	// Make a new Socket.IO Server instance and bind it to the HTTP server
	const io = createSIOServer(server);

	logger.debug(`Creating backend services...`);
	const manager = new Manager({ express: app, http: server, io });

	await manager.ready;
	logger.debug(`Creating Apollo Server...`);
	const apollo = new ApolloServer<GQLContext>({
		csrfPrevention: true,
		cache: "bounded",
		plugins: [ApolloServerPluginDrainHttpServer({ httpServer: server })],
		resolvers,
		typeDefs,
		rootValue: manager,
		formatError: (fe, error) => {
			const err = unwrapResolverError(error);
			if (err instanceof TMError) {
				return {
					...fe,
					message: err.message,
					extensions: {
						code: err.code,
						...err.extension,
					},
				};
			}

			return fe;
		},
	});

	logger.debug(`Starting servers, applying middleware...`);
	await apollo.start();
	app.use(
		"/api/graphql",
		json(),
		expressMiddleware(apollo, {
			context: async ({ req }) => {
				const authHeader =
					req.header("Authorization") ??
					(req.cookies["authToken"] as string) ??
					"";

				const token = authHeader.split(" ")[1];

				const vrf = verifyToken(token);
				const user = manager.userManager.get(vrf?.userId);
				if (user?.disabled)
					throw new TMError(
						"EACCDISABLED",
						"Your account has been disabled!",
						{ userId: user.id }
					);

				return { user };
			},
		})
	);

	io.on("connection", (socket) => {
		const auth = socket.handshake.headers.cookie
			?.split(";")
			.map((c) => c.trim())
			.find((c) => c.startsWith("authToken="))
			?.slice(11);
		if (!auth || !auth.startsWith("Bearer ")) return;
		const data = verifyToken(auth.split(" ")[1]);
		if (!data || typeof data.userId != "string") return socket.disconnect();

		const user = manager.userManager.get(data.userId);
		if (user?.disabled)
			throw new TMError(
				"EACCDISABLED",
				"Your account has been disabled!",
				{ userId: user.id }
			);
		socket.data.user = user;
	});

	await new Promise<void>((resolve) =>
		server.listen(process.env.PORT ?? 3018, resolve)
	);
	const addr = server.address();
	if (typeof addr === "string") throw new Error("");
	logger.info(
		`TrainManager ready and started!`,
		`Listening on ${addr?.address}:${addr?.port}`
	);

	return { client: manager, apollo };
}

logger.info(`Starting TrainManager/core`);
if (process.env.NODE_ENV !== "test") main();

export default main;
