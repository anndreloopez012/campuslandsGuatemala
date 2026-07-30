<template>
	<div class="flex flex-col items-center rounded-[40px] min-w-[208px] w-[208px] shadow-[0_0_16px_0_#11111166] backdrop-blur-[40px] bg-gradient-to-b from-[#FFFFFF1F] to-[#1111111F] mx-auto md:m-0 gap-y-3 px-4 py-10">
		<slot />
		<p class="gradient-text text-lg font-semibold text-center">{{ title }}</p>
		<p class="text-white text-sm text-center">{{ description }}</p>
	</div>
</template>

<script setup>

const props = defineProps({
	title: {
		type: String,
		default: 'Innovación'
	},
	description: {
		type: String,
		default: 'Buscar soluciones creativas y originales, adaptarse rápidamente a los cambios y promover la mejora continua.'
	}
})

</script>