import { ApolloServer } from "apollo-server-express";
import { config as env } from "dotenv";
import path from "path";

env({ path: path.resolve(process.cwd(), ".env.test") });

const dataset = {
	realms: [
		{
			managerId: null as string,
			name: "Test Realm",
			realmId: "eabb1da8-c64c-48e1-a6e6-fbd7b8e86143",
			id: "eabb1da8-c64c-48e1-a6e6-fbd7b8e86143",
			ownerId: "a739f1de-9c5e-4f1b-8413-b76e5549fff9",
		},
	],
	users: [
		{
			id: "a739f1de-9c5e-4f1b-8413-b76e5549fff9",
			name: "Administrator",
			username: "administrator",
			managerId: "users",
			realmId: null as string,
			passwordHash:
				"$2b$10$rVKeXA8IenQf5h9Q03VbfOMEGMKTHiXGlI3y6zZCJ1ZYiYIESlPEi",
			settings: {},
			disabled: false,
			admin: true,
			permissions: { global: 0, realm: [] as string[] },
		},
		{
			id: "a739f1de-9c5e-4f1b-8413-b76e5549fff8",
			name: "Disabled user",
			username: "disabled_user",
			managerId: "users",
			realmId: null as string,
			passwordHash:
				"$2b$10$rVKeXA8IenQf5h9Q03VbfOMEGMKTHiXGlI3y6zZCJ1ZYiYIESlPEi",
			settings: {},
			disabled: true,
			admin: false,
			permissions: { global: 0, realm: [] as string[] },
		},
	],
};

jest.setTimeout(10000);

import main from "./index";
import Client from "./types/client";

let client: Client;
let apollo: ApolloServer;

beforeAll(async () => {
	const { client: c, apollo: a } = await main();
	client = c;
	apollo = a;
	return c;
});

test("client has realms collection", () => {
	expect(client.realms).toBeDefined();
});


// test('client has ')

afterAll(async () => {
	await client.db.redis.quit();
	await apollo.stop();
	client.http.close();
});
