<script>
	import * as _ from 'lodash-es'

	let { value = {}, onsave } = $props()
</script>

<div class="link">
	<div class="message">Enter URL</div>
	<form
		onsubmit={(event) => {
			event.preventDefault()
			onsave(value)
		}}
	>
		<!-- svelte-ignore a11y_autofocus -->
		<input type="url" bind:value autofocus />
	</form>
</div>
