<script>
	import * as _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import Button from '$lib/builder/ui/Button.svelte'
	import UI from '../../ui'
	import imageCompression from 'browser-image-compression'

	let { value = {}, onsave, fieldOptions = {} } = $props()

	let imagePreview = $state(value?.url || '')
	let local_value = $state({
		alt: '',
		url: '',
		size: null,
		...value
	})
	let loading = $state(false)

	function setValue({ url, size }) {
		local_value = {
			...local_value,
			url: url,
			src: url,
			size
		}
	}

	async function encodeImageFileAsURL({ target }) {
		loading = true
		const { files } = target
		if (files.length > 0) {
			const image = files[0]

			// Compression options
			const options = {
				maxSizeMB: fieldOptions.maxSizeMB ?? 1,
				maxWidthOrHeight: fieldOptions.maxWidthOrHeight ?? 1920,
				useWebWorker: true
			}

			// Compress the image
			const compressedImage = await imageCompression(image, options)
			console.log(`Original size: ${image.size / 1024 / 1024} MB`)
			console.log(`Compressed size: ${compressedImage.size / 1024 / 1024} MB`)

			const key = `_images/${image.lastModified + image.name}`
			// TODO: Upload
			throw new Error('Not implemented')

			// if (url) {
			// 	imagePreview = url

			// 	setValue({
			// 		url,
			// 		size: Math.floor(image.size / 1024)
			// 	})

			// 	loading = false
			// } else {
			// 	loading = false
			// }
		}
	}
</script>

<div class="image-modal">
	{#if loading}
		<UI.Spinner />
	{:else}
		<div class="image-preview">
			{#if local_value.size}
				<span class="field-size">
					{local_value.size}KB
				</span>
			{/if}
			{#if imagePreview}
				<img src={imagePreview} alt="Preview" />
			{/if}
			<label class="image-upload">
				<Icon height="2rem" icon="uil:image-upload" />
				{#if !local_value.url}
					<span>Upload</span>
				{/if}
				<input onchange={encodeImageFileAsURL} type="file" accept="image/*" />
			</label>
		</div>
	{/if}
	<form
		onsubmit={(event) => {
			event.preventDefault()
			onsave(local_value)
		}}
	>
		<div class="inputs">
			<label class="image-input">
				<span>URL</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					autofocus
					oninput={({ target }) => {
						imagePreview = target.value
						local_value = {
							alt: '',
							url: target.value,
							size: null
						}
					}}
					value={local_value.url}
					type="url"
				/>
			</label>
			<label class="image-input">
				<span>Description</span>
				<input
					type="text"
					value={local_value.alt}
					oninput={({ target }) => {
						local_value = {
							...local_value,
							alt: target.value
						}
					}}
				/>
			</label>
		</div>
		<footer>
			<Button type="submit" label="Add Image" />
		</footer>
	</form>
</div>

<style lang="postcss">
	.image-modal {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		--Spinner-padding: 3rem;
	}
	.image-preview {
		width: 100%;
		height: 200px;
		position: relative;
		border: 2px dashed hsl(var(--border));
		border-radius: var(--radius);
		margin-bottom: 1rem;

		.image-upload {
			flex: 1 1 0%;
			padding: 1rem;
			cursor: pointer;
			position: absolute;
			inset: 0;
			width: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			color: hsl(var(--muted-foreground));
			background: transparent;
			font-weight: 500;
			text-align: center;
			transition: all 0.2s;
			border-radius: var(--radius);

			&:hover {
				background: hsl(var(--muted) / 0.5);
			}

			span {
				margin-top: 0.25rem;
			}

			input {
				visibility: hidden;
				border: 0;
				width: 0;
				position: absolute;
			}
		}

		.field-size {
			background: var(--color-gray-8);
			color: var(--color-gray-3);
			position: absolute;
			top: 0;
			left: 0;
			z-index: 1;
			padding: 0.25rem 0.5rem;
			font-size: var(--font-size-1);
			font-weight: 600;
			border-bottom-right-radius: 0.25rem;
		}

		img {
			position: absolute;
			inset: 0;
			object-fit: cover;
			height: 100%;
			width: 100%;
		}
	}

	.inputs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;

		.image-input {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			width: 100%;

			span {
				font-weight: 500;
				font-size: 0.875rem;
				color: hsl(var(--foreground));
			}

			input {
				flex: 1;
				padding: 0.5rem 0.75rem;
				border: 1px solid hsl(var(--border));
				border-radius: var(--radius);
				background: hsl(var(--background));
				color: hsl(var(--foreground));
				font-size: 0.875rem;
				transition: border-color 0.2s;

				&:focus {
					outline: none;
					border-color: hsl(var(--ring));
					box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
				}
			}
		}
	}

	footer {
		margin-top: 0.5rem;
	}
</style>
