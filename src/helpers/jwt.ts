import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

function verifyToken(token: string) {
	try {
		return jwt.verify(token, fs.readFileSync(path.join(__dirname, '..', '..', 'certs', 'public.pem')), { algorithms: ['RS256'] });
	}
	catch (err) {
		if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
			return;
		}
		else throw err;
	}
}

function signData(data: object) {
	return jwt.sign(data, fs.readFileSync(path.join(__dirname, '..', '..', 'certs', 'private.pem')), { algorithm: 'RS256', expiresIn: '24h' });
}

export { verifyToken, signData };