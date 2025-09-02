import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DatabaseService } from '$lib/database';
import { badRequestError, notFoundError, unauthorizedError } from '$lib/utils';
import type { SubmitVoteRequest } from '$lib/types';

export const GET: RequestHandler = async ({ params, request, platform }) => {
	try {
		const token = request.headers.get('x-admin-token');
		if (token && token != platform.env.ADMIN_TOKEN) {
			unauthorizedError();
		}

		const sessionKey = params.sessionKey;
		if (!sessionKey) {
			badRequestError('Session key is required');
		}

		const db = new DatabaseService(platform.env.DB);

		const session = await db.getSession(sessionKey);
		if (!session) {
			notFoundError();
			return;
		}

		const sessionId = session.id;

		const participantShares: Record<
			string,
			Array<number>
		> = await db.getParticipantShares(sessionId);

		const participantNames = Object.keys(participantShares);
		const participantLength = participantNames.length;

		if (!token) {
			for (const name of participantNames) {
				if (participantShares[name].length == participantLength - 1) continue;

				const participants = await db.getParticipants(sessionId);

				return json({
					topic: session.topic,
					description: session.description,
					stake: session.stake,
					participants
				});
			}
		}

		const participants = Object.entries(participantShares).map(
			([name, shares]) => ({
				name,
				share: shares.reduce((sum, value) => sum + value, 0) / participantLength
			})
		);

		return json({
			topic: session.topic,
			description: session.description,
			stake: session.stake,
			participants
		});
	} catch (err) {
		console.error('Error getting session data:', err);
		if (err instanceof Response) {
			throw err;
		}
		badRequestError('Failed to get session data: ' + err.body.message);
	}
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
	try {
		const sessionKey = params.sessionKey;
		if (!sessionKey) {
			badRequestError('Session key is required');
		}

		const db = new DatabaseService(platform.env.DB);

		const vote: SubmitVoteRequest = await request.json();

		const voterId = parseInt(request.headers.get('x-voter-id'));
		if (isNaN(voterId)) {
			badRequestError('Invalid voter ID');
		}

		const session = await db.getSession(sessionKey);
		if (!session) {
			notFoundError();
		}

		const participants = await db.getParticipants(session.id);

		if (vote.participants.length !== participants.length - 1) {
			badRequestError('Invalid number of share participants.');
		}

		const totalShares = vote.participants.reduce((sum, s) => sum + s.share, 0);
		if (totalShares != session.stake) {
			badRequestError('Total shares must equal session stake');
		}

		const sessionId = session.id;

		const hasVotedAlready = await db.voteExists(sessionId, voterId);
		if (hasVotedAlready) {
			badRequestError('You have already voted in this session');
		}

		const voterExists = participants.some((p) => p.id === voterId);
		if (!voterExists) {
			badRequestError('Voter is not a participant in this session');
		}

		if (vote.participants.some((s) => s.id === voterId)) {
			badRequestError('You cannot vote for yourself');
		}

		const allShareParticipantsExist = vote.participants.every((s) =>
			participants.some((p) => p.id === s.id)
		);
		if (!allShareParticipantsExist) {
			badRequestError('One or more participants in the shares do not exist');
		}

		const success = await db.submitVote(sessionId, vote);
		if (!success) {
			badRequestError('Failed to submit vote');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Error submitting vote:', err);
		if (err instanceof Response) {
			throw err;
		}
		badRequestError('Failed to submit vote: ' + err.body.message);
	}
};

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
	try {
		const adminToken = request.headers.get('x-admin-token');
		if (adminToken != platform.env.ADMIN_TOKEN) {
			unauthorizedError();
		}

		const sessionKey = params.sessionKey;
		if (!sessionKey) {
			badRequestError('Session key is required');
		}

		const db = new DatabaseService(platform.env.DB);

		const success = await db.deleteSession(sessionKey);
		if (!success) {
			badRequestError('Failed to delete session');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Error deleting session:', err);
		if (err instanceof Response) {
			throw err;
		}
		badRequestError('Failed to delete session: ' + err.body.message);
	}
};
