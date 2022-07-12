import { Request, Response } from "express";
import { signData } from "../../helpers/jwt";
import Client from "../../types/client";

async function login(client: Client, req: Request, res: Response) {
	const data = req.body;
	if (!data) return res.status(400).send(`Missing body!`);

	const { username, password } = data;
	if (!username || !password) return res.status(400).send({ message: `Missing data!`, error: { code: `EMISSINGDATA` } });
	if (typeof username != 'string' || typeof password != 'string') return res.status(400).send({ message: `Invalid data!`, error: { code: `EINVALIDDATA` } });

	const user = client.userManager.users.find(u => u.username === username);
	const valid = user?.verifyPassword(password);
	if (!valid) return res.status(401).send({ message: `Invalid username or password`, error: { code: `EBADAUTH` } });
	if (user.disabled) return res.status(401).send({ message: `This user is disabled!`, error: { code: `EAUTHDISABLEDUSER` } });

	const token = signData({ userId: user.id });
	return res.status(200).cookie(`authToken`, token, { secure: true, path: '/', sameSite: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1e3 }).send({ token, message: `Logged in succesfully!` });
}

export default login;