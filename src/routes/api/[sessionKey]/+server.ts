import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DatabaseService } from '$lib/database';
import { badRequestError, notFoundError, unauthorizedError } from '$lib/utils';
import type { Participant, SubmitVoteRequest } from '$lib/types';

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

		const votes = await db.getVotes(sessionId);
		const participants = await db.getParticipants(sessionId);

		if (!token) {
			const allVoted =
				participants.length * (participants.length - 1) === votes.length;

			if (!allVoted) {
				const allHaveDescriptions = participants.every((p) => p.description);

				return json({
					topic: session.topic,
					description: session.description,
					stake: session.stake,
					participants: participants.map((p) => ({
						id: p.id,
						name: p.name,
						description: p.description
							? token || allHaveDescriptions
								? p.description
								: 'Submitted'
							: null,
						voted: votes.some((v) => v.voterId === p.id)
					}))
				});
			}
		}

		const participantMap = Object.fromEntries(
			participants.map((p) => [p.id, p])
		);

		const weightedSums = participants.map((p) => {
			const receivedVotes = votes.filter((v) => v.recipientId === p.id);

			const weightedSum = receivedVotes.reduce((sum, v) => {
				const voter = participantMap[v.voterId]!;
				return sum + v.share * voter.roleWeight;
			}, 0);

			const totalVoterWeight = receivedVotes.reduce((sum, v) => {
				const voter = participantMap[v.voterId]!;
				return sum + voter.roleWeight;
			}, 0);

			const avgWeightedVote =
				totalVoterWeight > 0 ? weightedSum / totalVoterWeight : 0;

			const effectiveScore = avgWeightedVote * p.pppWeight;

			return {
				id: p.id,
				name: p.name,
				reasons: receivedVotes.filter((v) => v.reason).map((v) => v.reason),
				effectiveScore
			};
		});

		const totalEffectiveScore = weightedSums.reduce(
			(sum, p) => sum + p.effectiveScore,
			0
		);

		const weightedParticipants = weightedSums.map((p) => ({
			id: p.id,
			name: p.name,
			description: participantMap[p.id].description,
			share:
				totalEffectiveScore > 0
					? Math.floor((p.effectiveScore / totalEffectiveScore) * session.stake)
					: 0,
			reasons: p.reasons
		}));

		const allConfirmed = participants.every((p) => p.confirmed);

		return json({
			topic: session.topic,
			description: session.description,
			stake: session.stake,
			confirmed: allConfirmed,
			participants: weightedParticipants
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

		const allReasonsExist = vote.participants.every(
			(p) => p.reason && p.reason.trim().length > 0
		);
		if (!allReasonsExist) {
			badRequestError(
				'One or more participants in the vote do not have a share reason'
			);
		}

		const participants = await db.getParticipants(session.id);

		if (vote.participants.length !== participants.length - 1) {
			badRequestError('Invalid number of share participants.');
		}

		const voterExists = participants.some((p) => p.id === voterId);
		if (!voterExists) {
			badRequestError('Voter is not a participant in this session');
		}

		if (vote.participants.some((s) => s.id === voterId)) {
			badRequestError('You cannot vote for yourself');
		}

		const allHaveDescriptions = participants.every((p) => p.description);
		if (!allHaveDescriptions) {
			badRequestError('All participants must have a description before voting');
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

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	try {
		const token = request.headers.get('x-admin-token');
		if (token && token != platform.env.ADMIN_TOKEN) {
			unauthorizedError();
		}

		const sessionKey = params.sessionKey;
		if (!sessionKey) {
			badRequestError('Session key is required');
		}

		const updateParticipant = (await request.json()) as Partial<Participant> & {
			id: number;
		};
		if (!updateParticipant.id) {
			badRequestError('Participant ID required');
		}

		const db = new DatabaseService(platform.env.DB);
		const session = await db.getSession(sessionKey);
		if (!session) {
			notFoundError();
		}

		const participants = await db.getParticipants(session.id);
		const existing = participants.find((p) => p.id === updateParticipant.id);
		if (!existing) {
			badRequestError('Participant does not exist in this session');
		}

		const updatedParticipant: Participant = { ...existing };

		if (updateParticipant.description !== undefined) {
			if (!token && existing.description != existing.description) {
				unauthorizedError();
			}

			updatedParticipant.description = updateParticipant.description;
		}

		if (updateParticipant.confirmed !== undefined) {
			if (!token && updateParticipant.confirmed == false) {
				unauthorizedError();
			}

			updatedParticipant.confirmed = updateParticipant.confirmed;
		}

		const success = await db.updateParticipant(updatedParticipant);
		if (!success) {
			badRequestError('Failed to update participant');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Error updating participant description:', err);
		if (err instanceof Response) {
			throw err;
		}
		badRequestError(
			'Failed to update participant description: ' + (err as any).body?.message
		);
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
