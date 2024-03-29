import { Request, Response } from "express";
import { Manager, signData } from "../../internal";

async function login(client: Manager, req: Request, res: Response) {
	const data = req.body;
	if (!data) return res.status(400).send(`Missing body!`);

	const { username, password } = data;
	if (!username)
		return res.status(400).send({
			message: `Missing data!`,
			error: { code: `EMISSINGDATA` },
		});
	if (
		typeof username != "string" ||
		(password && typeof password != "string")
	)
		return res.status(400).send({
			message: `Invalid data!`,
			error: { code: `EINVALIDDATA` },
		});

	const user = client.userManager.users.find((u) => u.username === username);
	if (!user)
		return res.status(401).send({
			message: `Invalid user`,
			error: { code: `EBADAUTH`, extension: `user` },
		});
	const valid = user?.verifyPassword(password ?? "");
	if (!valid)
		return res.status(401).send({
			message: `Invalid password`,
			error: { code: `EBADAUTH`, extension: `password` },
		});
	if (user.disabled)
		return res.status(401).send({
			message: `This user is disabled!`,
			error: { code: `EAUTHDISABLEDUSER` },
		});

	const token = signData({ userId: user.id });
	return res
		.status(200)
		.cookie(`authToken`, `Bearer ${token}`, {
			secure: true,
			path: "/",
			sameSite: true,
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1e3,
		})
		.send({ token, message: `Logged in succesfully!` });
}

export { login };
