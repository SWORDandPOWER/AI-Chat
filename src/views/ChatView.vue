<template>
    <div class="chat-container">
        <ChatSidebar />
        <ChatWindow />
        <ChatInput />
    </div>
</template>

<script setup>
import ChatInput from '@/components/ChatInput.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ChatSidebar from '@/components/ChatSidebar.vue'

</script>
