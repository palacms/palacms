<script lang="ts">
	import { page } from '$app/state'
</script>

<div class="placeholder">{page.error?.message}</div>

<style>
	.placeholder {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		color: white;
	}
</style>
