<script setup lang="ts">
defineProps<{ icon: string }>()
</script>

<template>
	<span aria-hidden="true">{{ icon }}</span>
</template>
