// store/chatStore.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useChatStream } from '@/composables/useChatStream'

export const useChatStore = defineStore('chat', () => {
    // ============================================================
    // 1. 组合底层技术（Hook 不包含任何响应式状态）
    // ============================================================
    const { startStream, abortStream } = useChatStream()

    // ============================================================
    // 2. 全局响应式状态（驱动 UI 的数据）
    // ============================================================
    const sessions = ref(new Map([
        ['session_key_1', { id: 'session_1', messages: [] }],
        ['session_key_2', { id: 'session_2', messages: [] }]
    ]))
    const currentSessionId = ref('session_key_1')

    //message消息示范：
    // [
    //     { "role": "user", "content": "What's the highest mountain in the world?" },
    //     { "role": "assistant", "content": "The highest mountain in the world is Mount Everest." },
    //     { "role": "user", "content": "What is the second?" }
    //     { "role": "assistant", "content": "" }
    // ]

    // 🔥 UI 全局锁
    const isStreaming = ref(false)

    // ============================================================
    // 3. 私有工具函数（不对外暴露，仅供内部 Actions 复用）
    // ============================================================
    function getSession(id) {
        return sessions.value.get(id)
    }

    function addMessageToSession(sessionId, message) {
        const session = getSession(sessionId)
        if (session) {
            session.messages.push(message)
        }
    }

    function appendCharToSession(sessionId, char) {
        const session = getSession(sessionId)
        if (session && session.messages.length > 0) {
            const lastMsg = session.messages[session.messages.length - 1]
            lastMsg.content += char
        }
    }

    // ============================================================
    // 4. 核心业务 Actions（对外门面）
    // ============================================================

    /**
     * 发送消息（由 ChatInput 组件调用）
     */
    function sendMessage(prompt) {
        // 4.1 闭包锁定当前会话 ID（防止打字机运行时用户切换会话导致数据错乱）
        const targetId = currentSessionId.value

        // 4.2 写入用户消息 + 空 AI 占位
        addMessageToSession(targetId, { role: 'user', content: prompt })
        addMessageToSession(targetId, { role: 'assistant', content: '' })

        // 4.3 开启全局 UI 锁（输入框禁用、显示停止按钮）
        isStreaming.value = true

        // 4.4 调用底层 Hook，注入回调，并将当前 sessionId 传给后端
        // 后端收到 sessionId 后可以组装该会话历史，实现多轮上下文
        startStream(
            prompt,
            targetId,
            // onChar：逐字吐出
            (char) => {
                // 利用闭包锁定的 targetId，确保文字写回正确的会话
                appendCharToSession(targetId, char)
            },
            // onFinish：无论什么原因结束，释放全局锁
            () => {
                isStreaming.value = false
            }
        )
    }

    /**
     * 切换会话（由 ChatSidebar 组件调用）
     */
    function switchSession(id) {
        // 🔥 核心业务规则：如果正在生成，必须先熔断
        if (isStreaming.value) {
            abortStream() // 中断后，onFinish 会将 isStreaming 置为 false
        }
        currentSessionId.value = id
    }

    /**
     * 手动停止生成（由 ChatInput 的停止按钮调用）
     */
    function stopGenerating() {
        if (isStreaming.value) {
            abortStream()
        }
    }

    // ============================================================
    // 5. 暴露给组件（组件只依赖 Store，不依赖 Hook）
    // ============================================================
    return {
        // 响应式状态
        sessions,
        currentSessionId,
        isStreaming, // 👈 组件直接用于 :disabled 或 v-if

        // 业务方法
        sendMessage,
        switchSession,
        stopGenerating
    }
})