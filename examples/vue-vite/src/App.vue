<script setup lang="ts">
import type { Live2DInstance } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const host = ref<HTMLElement>()
const status = ref('loading')
let character: Live2DInstance | undefined

onMounted(async () => {
  character = await createLive2D({
    container: host.value!,
    coreUrl: '/live2dcubismcore.min.js',
    src: '/models/model.model3.json',
  })
  status.value = 'ready'
})

onBeforeUnmount(() => character?.dispose())
</script>

<template>
  <main>
    <h1>Vue Vite example</h1>
    <div ref="host" class="avatar" />
    <output>{{ status }}</output>
    <button type="button" @click="character?.motion('TapBody', 0)">
      Play motion
    </button>
  </main>
</template>
