<!-- ChatInput.vue -->
<template>
    <div>
        <input v-model="inputText" :disabled="store.isStreaming" placeholder="输入消息..." />
        <button v-if="!store.isStreaming" @click="handleSend">发送</button>
        <button v-else @click="store.stopGenerating">停止生成</button>
    </div>
</template>

<script setup>
import { useChatStore } from '@/stores/chatStore'
import { ref } from 'vue'

const store = useChatStore()
const inputText = ref('')

const handleSend = () => {
    if (!inputText.value.trim()) return
    store.sendMessage(inputText.value)
    inputText.value = ''
}
</script>