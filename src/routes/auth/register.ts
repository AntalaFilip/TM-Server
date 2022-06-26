import { Response } from "express";
import { TMRequest } from "../../middleware/httpauth";
import Client from "../../types/client";
import User from "../../types/user";

async function register(client: Client, req: TMRequest, res: Response) {
	const authUser = req.auth;
	if (!authUser.hasPermission('manage users') && !authUser.admin) return res.status(403).send({ message: 'Insufficient permissions!', error: { code: 'ENOPERM', permission: 'manage users' } });

	const data = req.body;
	if (!data) return res.status(400).send('Missing body!');

	const { username, password, name } = data;
	if (!username || !password || !name) return res.status(400).send({ message: `Missing data!`, error: { code: 'EMISSINGDATA' } });
	if (typeof username != 'string' || typeof password != 'string' || typeof name != 'string') return res.status(400).send({ message: `Invalid data!`, error: { code: `EINVALIDDATA` } });

	// if (settings && typeof settings != 'object') return res.status(400).send({ message: `Invalid settings object!`, error: { code: `EINVALIDDATA` } });

	const duplicate = client.userManager.users.find(user => user.username === username);

	if (duplicate) return res.status(400).send({ message: `A user with this username already exists`, error: { code: 'EUSERNAMEINUSE' } });

	const created = await client.userManager.create({ name, username, passwordHash: User.hashPassword(password), managerId: client.userManager.id, realmId: null });
	await client.db.redis.xadd(`audit`, "create user", authUser.id);

	const toReturn = created.metadata();
	delete toReturn.passwordHash;
	delete toReturn.managerId;

	return res.status(201).send(toReturn);
}
export default register;