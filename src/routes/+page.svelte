<script lang="ts">
	let adminToken = '';

	let newSession = {
		topic: '',
		description: '',
		stake: null,
		participants: [
			{ name: '', description: '' },
			{ name: '', description: '' }
		]
	};

	let sessionKey = '';

	let session: {
		id: number;
		topic: string;
		description: string;
		stake: number;
		participants: {
			id: number;
			name: string;
			description: string;
			share: number;
		}[];
	} | null = null;

	let stakeDistributed = false;

	$: totalAllocatedShares =
		session?.participants.reduce((sum, p) => sum + (p.share || 0), 0) || 0;

	let voterId: number | null = null;

	let loading = false;

	let message = '';
	let messageType: 'success' | 'error' = 'success';

	function addParticipant() {
		newSession.participants = [
			...newSession.participants,
			{ name: '', description: '' }
		];
	}

	function removeParticipant() {
		newSession.participants = newSession.participants.slice(0, -1);
	}

	function selectParticipant({ id }: { id: number }) {
		voterId = id;
		session.participants = session.participants.filter(
			({ id }) => id !== voterId
		);
	}

	async function createSession() {
		loading = true;
		try {
			const response = await fetch('/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-admin-token': adminToken
				},
				body: JSON.stringify(newSession)
			});

			if (response.ok) {
				const result = (await response.json()) as { sessionKey: string };
				sessionKey = result.sessionKey;
				showMessage(
					`Session created successfully! Session key: ${sessionKey}`,
					'success'
				);
				session = null;
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		} finally {
			loading = false;
		}
	}

	async function submitVote() {
		loading = true;
		try {
			const response = await fetch(`/${sessionKey}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-voter-id': voterId.toString()
				},
				body: JSON.stringify({
					voterId,
					participants: session.participants.map(({ id, share }) => ({
						id,
						share: share || 0
					}))
				})
			});

			if (response.ok) {
				showMessage('Vote submitted successfully!', 'success');
				await viewSession();
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		} finally {
			loading = false;
		}
	}

	async function viewSession() {
		loading = true;
		try {
			const headers: any = {
				'Content-Type': 'application/json'
			};

			if (adminToken) {
				headers['x-admin-token'] = adminToken;
			}

			const response = await fetch(`/${sessionKey}`, {
				method: 'GET',
				headers
			});

			if (response.ok) {
				session = await response.json();
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		} finally {
			loading = false;
		}
	}

	async function deleteSession() {
		if (!confirm('Are you sure you want to delete this session?')) {
			return;
		}

		loading = true;
		try {
			const response = await fetch(`/${sessionKey}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'x-admin-token': adminToken
				}
			});

			if (response.ok) {
				showMessage('Session deleted successfully!', 'success');
				sessionKey = '';
				session = null;
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		} finally {
			loading = false;
		}
	}

	function showMessage(msg: string, type: 'success' | 'error') {
		message = msg;
		messageType = type;
		setTimeout(() => {
			message = '';
		}, 5000);
	}
</script>

<svelte:head>
	<title>ReVanced Vote</title>
</svelte:head>

<main>
	<h1>ReVanced Vote</h1>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	{#if !session}
		<div class="section">
			<h2>Create session</h2>
			{#if adminToken && !session}
				<input
					bind:value={newSession.topic}
					placeholder="Topic"
					class="input"
				/>
				<textarea
					bind:value={newSession.description}
					placeholder="Description"
					class="textarea"
				></textarea>
				<input
					bind:value={newSession.stake}
					type="number"
					step="0.01"
					placeholder="Stake"
					class="input"
				/>
			{/if}
			<input
				bind:value={adminToken}
				type="password"
				placeholder="Admin token"
				class="input"
			/>

			{#if adminToken}
				<h3>Participants</h3>
				<div class="section">
					{#each newSession.participants as participant, i}
						<div class="participant">
							<input
								bind:value={participant.name}
								placeholder="Name"
								class="input"
							/>
							<textarea
								bind:value={participant.description}
								placeholder="Description"
								class="input"
							></textarea>
						</div>
					{/each}
				</div>

				<button on:click={addParticipant}>Add</button>
				{#if newSession.participants.length > 2}
					<button on:click={removeParticipant}>Remove</button>
				{/if}
				<button on:click={createSession} disabled={loading}
					>Create Session</button
				>
			{/if}
		</div>
	{/if}

	<div class="section">
		<h2>Session</h2>
		{#if session}
			<p><strong>Name:</strong> {session.topic}</p>
			<p><strong>Description:</strong> {session.description}</p>
			<p>
				<strong>Stake:</strong>
				{session.stake - totalAllocatedShares}
			</p>

			<h3>Participants</h3>
			{#each session.participants as participant}
				<div class="section">
					<p>
						<strong>Name:</strong>
						{participant.name}
					</p>
					{#if voterId || participant.share || !participant.id}
						<p><strong>Description:</strong> {participant.description}</p>
						{#if participant.id}
							<input
								bind:value={participant.share}
								on:input={() => {
									stakeDistributed = totalAllocatedShares == session.stake;
								}}
								type="number"
								step="0.01"
								min="0"
								placeholder="Share"
								class="input"
							/>
						{:else}
							<p><strong>Share:</strong> {participant.share || 0}</p>
						{/if}
					{:else}
						<button on:click={() => selectParticipant(participant)}
							>This is me</button
						>
					{/if}
				</div>
			{/each}

			{#if stakeDistributed}
				<button on:click={submitVote} disabled={loading}>Submit Vote</button>
			{/if}
		{:else}
			<input bind:value={sessionKey} placeholder="Session key" class="input" />
			{#if sessionKey}
				<button on:click={viewSession} disabled={loading}>View Session</button>
			{/if}
			{#if adminToken}
				<button on:click={deleteSession} disabled={loading}
					>Delete Session</button
				>
			{/if}
		{/if}
	</div>
</main>

<style lang="scss">
	:root {
		background: black;
		color: #888;
		font-family: sans-serif;
	}

	h1,
	h2,
	h3,
	strong {
		color: white;
	}

	h2,
	h3 {
		&:after {
			padding-top: 1rem;
			content: '';
			display: block;
			border-bottom: #888 solid 1px;
		}
	}

	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	textarea {
		min-height: 2rem;
		font-family: sans-serif;
		resize: vertical;
	}

	input,
	textarea {
		background: #333;
		color: white;
		border: none;
		padding: 0.5rem;
		outline: 1px solid #555;

		&:focus {
			outline: 1px solid #777;
		}

		&::placeholder {
			color: #888;
		}

		&:hover {
			background: #444;
			outline: 1px solid #666;
		}
	}

	button {
		background: #444;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		cursor: pointer;

		&:hover {
			background: #555;
		}

		&:disabled {
			background: #666;
			cursor: not-allowed;
		}

		&:focus {
			outline: 1px solid #777;
		}
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: #222;
		padding: 0rem 1rem 1rem 1rem;

		.participant {
			padding: 0.5rem 0;
		}
	}

	.participant {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	p {
		margin: 0;
	}

	.message {
		padding: 0.5rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.success {
		background-color: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
	}

	.error {
		background-color: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
	}
</style>
