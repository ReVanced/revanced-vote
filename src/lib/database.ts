import type { D1Database } from '@cloudflare/workers-types';
import type {
	Session,
	Participant,
	SubmitVoteRequest,
	CreateSessionRequest
} from './types.js';

export class DatabaseService {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async createSession(
		session: CreateSessionRequest & { key: string }
	): Promise<void> {
		const result = await this.db
			.prepare(
				'INSERT INTO sessions (key, topic, description, stake) VALUES (?, ?, ?, ?) RETURNING id'
			)
			.bind(session.key, session.topic, session.description, session.stake)
			.first<{ id: number }>();

		if (!result) {
			throw new Error('Failed to create session');
		}

		const participantStatements = session.participants.map((participant) =>
			this.db
				.prepare(
					'INSERT INTO participants (session_id, name, description) VALUES (?, ?, ?)'
				)
				.bind(result.id, participant.name, participant.description)
		);

		await this.db.batch(participantStatements);
	}

	async getSessionKeys(): Promise<string[]> {
		const { results } = await this.db
			.prepare('SELECT key FROM sessions')
			.all<{ key: string }>();

		return results.map((row) => row.key);
	}

	async getSession(sessionKey: string): Promise<Session | null> {
		const result = await this.db
			.prepare('SELECT * FROM sessions WHERE key = ? LIMIT 1')
			.bind(sessionKey)
			.first<Session>();
		return result || null;
	}

	async getParticipants(sessionId: number): Promise<Participant[]> {
		const { results } = await this.db
			.prepare(
				'SELECT id, name, description FROM participants WHERE session_id = ?'
			)
			.bind(sessionId)
			.all<Participant>();
		return results || [];
	}

	async submitVote(
		sessionId: number,
		vote: SubmitVoteRequest
	): Promise<boolean> {
		try {
			const voteStatements = vote.participants.map((p) =>
				this.db
					.prepare(
						'INSERT INTO votes (session_id, voter_id, recipient_id, share) VALUES (?, ?, ?, ?)'
					)
					.bind(sessionId, vote.voterId, p.id, p.share)
			);

			await this.db.batch(voteStatements);
			return true;
		} catch (error) {
			console.error('Error submitting vote:', error);
			return false;
		}
	}

	async voteExists(sessionId: number, voterId: number): Promise<boolean> {
		const { count } = await this.db
			.prepare(
				'SELECT COUNT(*) as count FROM votes WHERE session_id = ? AND voter_id = ?'
			)
			.bind(sessionId, voterId)
			.first<{ count: number }>();

		return count > 0;
	}

	async deleteSession(sessionKey: string): Promise<boolean> {
		try {
			const { success } = await this.db
				.prepare('DELETE FROM sessions WHERE key = ?')
				.bind(sessionKey)
				.run();
			return success;
		} catch (error) {
			console.error('Error deleting session:', error);
			return false;
		}
	}

	async getParticipantShares(
		sessionId: number
	): Promise<Record<string, Array<number>>> {
		const { results } = await this.db
			.prepare(
				`
				SELECT 
					p.name,
					p.description,
					v.share
				FROM participants p
				LEFT JOIN votes v 
					ON p.id = v.recipient_id AND v.session_id = ?
				WHERE p.session_id = ?;
				`
			)
			.bind(sessionId, sessionId)
			.all<{
				name: string;
				share: number;
			}>();

		const participantShares: Record<string, Array<number>> = {};

		results.map((result) => {
			const { name, share } = result;

			if (!participantShares[name]) participantShares[name] = [];

			if (share != null) participantShares[name].push(share);
		});

		return participantShares;
	}
}
