import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DatabaseService } from '$lib/database';
import {
	generateSessionKey,
	badRequestError,
	unauthorizedError
} from '$lib/utils';
import type { CreateSessionRequest } from '$lib/types';
import { ADMIN_TOKEN } from '$env/static/private';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const token = request.headers.get('x-admin-token');
		if (token != ADMIN_TOKEN) {
			unauthorizedError();
		}

		const body: CreateSessionRequest = await request.json();

		if (!body.topic || !body.description || !body.stake || !body.participants) {
			badRequestError('Missing required fields');
		}

		if (body.participants.length < 2) {
			badRequestError('At least 2 participants are required');
		}

		for (const participant of body.participants) {
			if (!participant.name || !participant.description) {
				badRequestError('Each participant must have a name and description');
			}
		}

		const sessionKey = generateSessionKey();

		const db = new DatabaseService(platform.env.DB);
		await db.createSession({
			key: sessionKey,
			topic: body.topic,
			description: body.description,
			stake: body.stake,
			participants: body.participants
		});

		return json(sessionKey);
	} catch (err) {
		console.error('Error creating session:', err);
		if (err instanceof Response) {
			throw err;
		}
		badRequestError('Failed to create session: ' + err.message);
	}
};

export const GET: RequestHandler = async ({ request, platform }) => {
	try {
		const token = request.headers.get('x-admin-token');
		if (token != ADMIN_TOKEN) {
			unauthorizedError();
		}

		const db = new DatabaseService(platform.env.DB);
		const sessionKeys = await db.getSessionKeys();

		return json(sessionKeys);
	} catch (err) {
		console.error('Error getting sessions:', err);
		if (err instanceof Response) {
			throw err;
		}
		badRequestError('Failed to get sessions: ' + err.message);
	}
};
