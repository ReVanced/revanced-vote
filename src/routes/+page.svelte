<script lang="ts">
	let adminToken = '';

	let newSession = {
		topic: '',
		description: '',
		stake: null,
		participants: [
			{ name: '', roleWeight: null, pppWeight: null },
			{ name: '', roleWeight: null, pppWeight: null }
		]
	};

	let sessionKey = '';
	let sessionKeys: string[] | null = null;

	let currentSession: {
		id: number;
		topic: string;
		description: string;
		stake: number;
		participants: {
			id: number;
			name: string;
			description?: string;
			share?: number;
			reason?: string;
			reasons?: string[];
		}[];
	} | null = null;

	$: allDescriptionsSubmitted =
		currentSession?.participants.every(
			(p) => p.description && p.description.trim() !== ''
		) || false;

	let currentParticipant: {
		id: number;
		description?: string;
	} | null = null;

	let stakeDistributed = false;

	$: totalAllocatedShares =
		currentSession?.participants.reduce((sum, p) => sum + (p.share || 0), 0) ||
		0;

	let message = '';
	let messageType: 'success' | 'error' = 'success';

	function addParticipant() {
		newSession.participants = [
			...newSession.participants,
			{ name: '', roleWeight: null, pppWeight: null }
		];
	}

	function removeParticipant() {
		newSession.participants = newSession.participants.slice(0, -1);
	}

	function selectParticipant(participant) {
		currentParticipant = participant;

		if (allDescriptionsSubmitted) {
			currentSession.participants = currentSession.participants.filter(
				(p) => p.id !== currentParticipant.id
			);
		} else {
			currentSession.participants = [participant];
		}
	}

	function submitCurrentParticipantDescription() {
		if (
			!currentParticipant.description ||
			currentParticipant.description.trim() === ''
		) {
			showMessage('Description cannot be empty', 'error');
			return;
		}

		fetch(`/api/${sessionKey}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				participantId: currentParticipant.id,
				description: currentParticipant.description
			})
		})
			.then(async (response) => {
				if (response.ok) {
					showMessage('Description submitted successfully!', 'success');
					currentParticipant = null;
					await viewSession();
				} else {
					const error = (await response.json()) as { message: string };
					showMessage(error.message, 'error');
				}
			})
			.catch((err) => {
				showMessage(err, 'error');
			});
	}

	async function createSession() {
		try {
			const response = await fetch('/api', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-admin-token': adminToken
				},
				body: JSON.stringify(newSession)
			});

			if (response.ok) {
				sessionKey = (await response.json()) as string;
				showMessage(
					`Session created successfully! Session key: ${sessionKey}`,
					'success'
				);
				currentSession = null;
				getSessionKeys();
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		}
	}

	async function submitVote() {
		try {
			const response = await fetch(`/api/${sessionKey}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-voter-id': currentParticipant.id.toString()
				},
				body: JSON.stringify({
					voterId: currentParticipant.id,
					participants: currentSession.participants.map(
						({ id, share, reason }) => ({
							id,
							share: share || 0,
							reason
						})
					)
				})
			});

			if (response.ok) {
				showMessage('Vote submitted successfully!', 'success');
				currentParticipant = null;
				await viewSession();
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		}
	}

	async function viewSession() {
		try {
			const headers: any = {
				'Content-Type': 'application/json'
			};

			if (adminToken) {
				headers['x-admin-token'] = adminToken;
			}

			const response = await fetch(`/api/${sessionKey}`, {
				method: 'GET',
				headers
			});

			if (response.ok) {
				currentSession = await response.json();
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
		}
	}

	let getSessionKeysTimeout: number;
	function getSessionKeys() {
		sessionKeys = null;

		if (!adminToken) {
			message = null;
			return;
		}

		if (getSessionKeysTimeout) {
			clearTimeout(getSessionKeysTimeout);
		}

		getSessionKeysTimeout = setTimeout(async () => {
			try {
				const response = await fetch('/api', {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'x-admin-token': adminToken
					}
				});

				if (response.ok) {
					sessionKeys = (await response.json()) as string[];
				} else {
					const error = (await response.json()) as { message: string };
					showMessage(error.message, 'error');
					sessionKeys = null;
				}
			} catch (err) {
				showMessage(err, 'error');
			}
		}, 300);
	}

	async function deleteSession() {
		if (!confirm('Are you sure you want to delete this session?')) {
			return;
		}

		try {
			const response = await fetch(`/api/${sessionKey}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'x-admin-token': adminToken
				}
			});

			if (response.ok) {
				showMessage('Session deleted successfully!', 'success');
				sessionKeys = sessionKeys.filter((key) => key !== sessionKey);
				sessionKey = '';
				currentSession = null;
			} else {
				const error = (await response.json()) as { message: string };
				showMessage(error.message, 'error');
			}
		} catch (err) {
			showMessage(err, 'error');
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
	<header>
		<img alt="ReVanced logo" src="logo.svg" />
		<h1>ReVanced Vote</h1>
	</header>

	{#if message}
		<div class="message {messageType}">
			{message}
		</div>
	{/if}

	{#if !currentSession}
		<div class="section">
			<h2>Admin</h2>
			<input
				bind:value={adminToken}
				on:input={getSessionKeys}
				type="password"
				placeholder="Admin token"
				class="input"
			/>
		</div>

		{#if sessionKeys}
			<form class="section">
				<h2>Create session</h2>
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

				<h3>Participants</h3>
				<div class="section">
					{#each newSession.participants as participant, i}
						<div class="participant">
							<p>Participant {i + 1}</p>
							<input
								bind:value={participant.name}
								placeholder="Name"
								class="input"
							/>
							<input
								bind:value={participant.roleWeight}
								placeholder="Role weight"
								class="input"
								type="number"
								step="0.01"
								min="0.01"
							/>
							<input
								bind:value={participant.pppWeight}
								placeholder="PPP weight"
								class="input"
								type="number"
								step="0.01"
								min="0.01"
							/>
						</div>
					{/each}
				</div>

				<button on:click={addParticipant}>Add participant</button>
				{#if newSession.participants.length > 2}
					<button on:click={removeParticipant}>Remove</button>
				{/if}
				<button on:click={createSession}>Create session</button>
			</form>
		{/if}
	{/if}

	{#if sessionKeys || !adminToken}
		<form class="section">
			<h2>
				{#if currentSession}
					Session {sessionKey}
				{:else if sessionKeys}
					Select session
				{:else}
					View session
				{/if}
			</h2>
			{#if currentSession}
				<p><strong>Name:</strong> {currentSession.topic}</p>
				<p><strong>Description:</strong> {currentSession.description}</p>
				<p>
					<strong>Stake:</strong>
					{currentSession.stake - totalAllocatedShares}
				</p>

				<h3>Participants</h3>
				{#if allDescriptionsSubmitted || adminToken}
					{#each currentSession.participants as participant}
						<div class="section">
							<p>
								<strong>Name:</strong>
								{participant.name}
							</p>
							{#if participant.description}
								<p><strong>Description:</strong> {participant.description}</p>
							{/if}

							{#if adminToken || participant.reasons}
								<p><strong>Share:</strong> {participant.share || 0}</p>
								{#if participant.reasons.length > 0}
									<strong>Reasons:</strong>
									<ul>
										{#each participant.reasons as reason}
											<li>{reason}</li>
										{/each}
									</ul>
								{/if}
							{:else if !currentParticipant}
								<button on:click={() => selectParticipant(participant)}>
									This is me
								</button>
							{:else}
								<input
									bind:value={participant.share}
									on:input={() => {
										stakeDistributed =
											totalAllocatedShares == currentSession.stake;
									}}
									type="number"
									step="0.01"
									min="0"
									placeholder="Share"
									class="input"
								/>
								<textarea bind:value={participant.reason} placeholder="Reason"
								></textarea>
							{/if}
						</div>
					{/each}
				{:else}
					{#each currentSession.participants.filter((p) => !p.description) as participant}
						<div class="section">
							<p>
								<strong>Name:</strong>
								{participant.name}
							</p>
							{#if !currentParticipant}
								<button on:click={() => selectParticipant(participant)}>
									Set a description
								</button>
							{:else}
								<textarea
									bind:value={currentParticipant.description}
									placeholder="Description"
									class="input"
								></textarea>
								<button on:click={() => submitCurrentParticipantDescription()}
									>Submit</button
								>
							{/if}
						</div>
					{/each}
				{/if}
				{#if stakeDistributed && currentParticipant}
					<button on:click={submitVote}>Submit Vote</button>
				{/if}
			{:else if sessionKeys}
				{#if sessionKeys.length > 0}
					<ul>
						{#each sessionKeys as key}
							<li>
								{key}
								<button on:click={() => (sessionKey = key) && viewSession()}
									>View</button
								>
								{#if sessionKeys}
									<button on:click={() => (sessionKey = key) && deleteSession()}
										>Delete</button
									>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p>No sessions available. Create a session first.</p>
				{/if}
			{:else}
				<input
					bind:value={sessionKey}
					placeholder="Session key"
					class="input"
				/>
				{#if sessionKey}
					<button on:click={viewSession}>View</button>
				{/if}
			{/if}
		</form>
		{#if currentSession}
			<button on:click={() => (currentSession = currentParticipant = null)}>
				Back to start</button
			>
		{/if}
	{/if}
</main>

<style lang="scss">
	:root {
		background: black;
		color: #888;
		font-family: sans-serif;
	}

	ul {
		margin: 0rem;
		li {
			margin-bottom: 0.5rem;
		}
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

	header {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 1rem;

		img {
			max-height: 5rem;
		}

		h1 {
			text-align: center;
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
		width: min-content;
		white-space: nowrap;
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
