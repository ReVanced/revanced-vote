export interface Session {
	id: number;
	key: string;
	topic: string;
	description: string;
	stake: number;
}

export interface Participant {
	id: number;
	name: string;
	description: string;
}

export interface CreateSessionRequest {
	topic: string;
	description: string;
	stake: number;
	participants: Array<{
		name: string;
		description: string;
	}>;
}

export interface SubmitVoteRequest {
	voterId: number;
	participants: Array<{
		id: number;
		share: number;
		reason: string;
	}>;
}

export interface SessionResponse {
	topic: string;
	description: string;
	stake: number;
	participants: Array<{
		name: string;
		share: number;
	}>;
}
