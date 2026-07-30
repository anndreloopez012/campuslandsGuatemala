<template>
	<div class="relative min-w-[465px] w-[465px] h-[514px]">
		<img src="/img/border-gradient.svg" alt="" class="w-full h-full">
		<img :src="img" alt="" class="absolute object-contain bottom-2 left-[-100px] h-[623px] !min-w-[642px]">
		<!-- <div class="flex items-center absolute gap-2 bg-white shadow-[0_3px_2px_#00005133] z-[3] rounded-[18px] h-[68px] top-[25%] left-[-50px] px-6">
			<img src="img/icons/img-python.svg" alt="" class="">
			<p class="font-semibold text-[#111111] text-[20px]">Python</p>
		</div>
		<div class="flex items-center absolute gap-2 bg-white shadow-[0_3px_2px_#00005133] z-[3] rounded-[18px] h-[68px] top-[15%] right-[-60px] px-6">
			<img src="/img/icons/img-js.svg" alt="" class="">
			<p class="font-semibold text-[#111111] text-[20px]">JavaScript</p>
		</div>
		<div class="flex items-center absolute gap-2 bg-white shadow-[0_3px_2px_#00005133] z-[3] rounded-[18px] h-[68px] bottom-[10%] left-[-37px] px-6">
			<img src="/img/icons/img-aws.svg" alt="" class="">
			<p class="font-semibold text-[#111111] text-[20px]">AWS</p>
		</div>
		<div class="flex items-center absolute gap-2 bg-white shadow-[0_3px_2px_#00005133] z-[3] rounded-[18px] h-[68px] bottom-[32%] right-[-70px] px-6">
			<img src="/img/icons/img-docker.svg" alt="" class="">
			<p class="font-semibold text-[#111111] text-[20px]">Docker</p>
		</div> -->
	</div>
</template>

<script setup>

const props = defineProps({
	img: {
		type: String,
		default: '/img/campers/camper-agendar.png'
	}
})

</script>