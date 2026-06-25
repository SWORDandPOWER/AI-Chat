<!-- ChatSidebar.vue -->
<script setup>
import { useChatStore } from '@/store/chatStore'

const store = useChatStore()

const handleSwitch = (id) => {
    store.switchSession(id) // 内部自动处理中断，组件完全无感知
}
</script>

<template>
    <div v-for="[id, session] in store.sessions" :key="id" :class="{ active: store.currentSessionId === id }"
        @click="handleSwitch(id)">
        {{ id }}
    </div>
</template>