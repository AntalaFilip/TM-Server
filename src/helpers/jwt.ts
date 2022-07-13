import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

function verifyToken(token: string) {
	try {
		const payload = jwt.verify(
			token,
			fs.readFileSync(
				path.join(__dirname, "..", "..", "certs", "public.pem")
			),
			{ algorithms: ["RS256"] }
		);
		if (typeof payload != "object") return;
		return payload;
	} catch (err) {
		if (
			err instanceof jwt.JsonWebTokenError ||
			err instanceof jwt.TokenExpiredError
		) {
			return;
		} else throw err;
	}
}

function signData(data: object) {
	return jwt.sign(
		data,
		fs.readFileSync(
			path.join(__dirname, "..", "..", "certs", "private.pem")
		),
		{ algorithm: "RS256", expiresIn: "24h" }
	);
}

export { verifyToken, signData };
