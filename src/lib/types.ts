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
	roleWeight: number;
	pppWeight: number;
	confirmed: boolean;
}

export interface CreateSessionRequest {
	topic: string;
	description: string;
	stake: number;
	participants: Array<{
		name: string;
		roleWeight: number;
		pppWeight: number;
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
