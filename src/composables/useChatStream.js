// composables/useChatStream.js
export function useChatStream() {
    // 非响应式资源句柄（不放入 Pinia state）
    let controller = null
    let typewriterTimer = null

    /**
     * 启动流式请求
     * @param {string} prompt 用户输入
     * @param {string} sessionId 当前会话 ID，用于后端根据ID查找数据库里当前的哪次对话，服务端把这条对话的历史与本次 prompt 拼接后发送给模型
     * @param {Function} onChar 吐出单个字符的回调（由 Store 注入）
     * @param {Function} onFinish 流彻底结束的回调（无论成功/失败/中断）
     */
    async function startStream(prompt, sessionId, onChar, onFinish) {
        // ===== 1. 并发防护：如果上一次请求还在，强行熔断 =====
        if (controller) {
            controller.abort()
            controller = null
        }
        if (typewriterTimer) {
            clearInterval(typewriterTimer)
            typewriterTimer = null
        }

        // ===== 2. 初始化本轮资源 =====
        controller = new AbortController()
        const charQueue = []      // 蓄水池（单字队列）
        let isNetworkDone = false // 网络流是否已关闭

        // ===== 3. 打字机（消费者） =====
        typewriterTimer = setInterval(() => {
            if (charQueue.length > 0) {
                const char = charQueue.shift()
                onChar(char) // 回调给 Store
            } else if (isNetworkDone) {
                // 网络已关且队列已空，打字机优雅退场
                clearInterval(typewriterTimer)
                typewriterTimer = null
            }
        }, 40)

        try {
            // ===== 4. 网络请求（生产者） =====
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                // 把 sessionId 一并发给后端，后端可以结合此 ID 查历史并构建多轮上下文
                body: JSON.stringify({ prompt, sessionId })
            })

            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const reader = response.body.getReader()
            const decoder = new TextDecoder('utf-8')
            let buffer = ''

            while (true) {
                const { value, done } = await reader.read()
                if (done) {
                    isNetworkDone = true
                    break
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const content = line.replace('data: ', '').trim()
                        if (content) {
                            // 将文本打散成单字，推入蓄水池
                            charQueue.push(...content.split(''))
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[useChatStream] 请求被主动中断')
            } else {
                console.error('[useChatStream] 流式异常:', error)
                // 异常时标记网络结束，让打字机退场
                isNetworkDone = true
            }
        } finally {
            // ===== 5. 终极清理（无痕销毁） =====
            // 5.1 立刻杀死打字机
            if (typewriterTimer) {
                clearInterval(typewriterTimer)
                typewriterTimer = null
            }

            // 5.2 紧急清仓（防止残血数据丢失）
            if (charQueue.length > 0) {
                const remaining = charQueue.join('')
                onChar(remaining) // 一次性吐出所有残血
                charQueue.length = 0
            }

            // 5.3 通知外部（Store）流彻底结束了
            onFinish()

            // 5.4 释放控制器引用
            controller = null
        }
    }

    /**
     * 主动中断（由 Store 调用）
     */
    function abortStream() {
        if (controller) {
            controller.abort()
            controller = null
        }
    }

    return { startStream, abortStream }
}