import { error } from '@sveltejs/kit';

export function generateSessionKey(): string {
	return (
		Math.random().toString(36).substring(2, 15) +
		Math.random().toString(36).substring(2, 15)
	);
}

export function unauthorizedError() {
	throw error(401, 'Unauthorized - Invalid admin token');
}

export function badRequestError(message: string) {
	throw error(400, message);
}

export function notFoundError(message: string = 'Session not found') {
	throw error(404, message);
}

export function forbiddenError(message: string) {
	throw error(403, message);
}
