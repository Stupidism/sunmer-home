'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Mic, Keyboard, Send, Loader2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

// 语音输入示例
const VOICE_INPUT_EXAMPLES = [
  { category: '睡眠', examples: ['入睡', '睡醒', '睡了30分钟', '睡了2小时'] },
  { category: '喂奶', examples: ['瓶喂母乳80毫升', '瓶喂奶粉90毫升', '亲喂15分钟', '吸奶100毫升', '吐奶'] },
  { category: '换尿布', examples: ['换尿布有大便', '换尿布小便', '大小便黄色'] },
  { category: '补剂', examples: ['吃了AD', '吃了D3'] },
  { category: '运动', examples: ['抬头5分钟', '被动操10分钟', '翻身3次', '拉坐5次'] },
  { category: '其他', examples: ['排气操', '洗澡', '户外晒太阳', '早教'] },
]

interface VoiceInputProps {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

interface VoiceInputResponse {
  success: boolean
  message: string
  code?: string
  needConfirmation?: boolean
  activity?: {
    id: string
    type: string
  }
  parsed?: {
    confidence: number
    originalText: string
  }
  error?: string
}

export function VoiceInput({ onSuccess, onError }: VoiceInputProps) {
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // 检查是否支持语音识别
  const [speechSupported, setSpeechSupported] = useState(false)
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(!!SpeechRecognition)
  }, [])

  const handleSubmit = useCallback(async (inputText?: string) => {
    const textToSubmit = inputText || text
    if (!textToSubmit.trim() || isLoading) return

    setIsLoading(true)
    setResult(null)

    try {
      // 发送用户本地时间，格式：2024-01-22 15:30:00
      const now = new Date()
      const localTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/voice-input'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSubmit.trim(), localTime }),
      })

      const data: VoiceInputResponse = await response.json()

      if (response.ok && data.needConfirmation) {
        setResult({ type: 'success', message: data.message })
        setText('')
      } else if (response.ok && data.success) {
        setResult({ type: 'success', message: data.message })
        setText('')
        onSuccess?.(data.message)
        // 刷新活动列表
        queryClient.invalidateQueries({ queryKey: ['activities'] })
        queryClient.invalidateQueries({ queryKey: ['sleepState'] })
      } else {
        const errorMsg = data.error || '解析失败'
        setResult({ type: 'error', message: errorMsg })
        onError?.(errorMsg)
      }
    } catch (error) {
      const errorMsg = '网络错误，请重试'
      setResult({ type: 'error', message: errorMsg })
      onError?.(errorMsg)
      console.error('Voice input error:', error)
    } finally {
      setIsLoading(false)
      // 3秒后清除结果提示
      setTimeout(() => setResult(null), 3000)
    }
  }, [text, isLoading, onSuccess, onError, queryClient])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // 开始语音识别
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // 如果不支持语音识别，切换到文字模式
      setMode('text')
      setTimeout(() => inputRef.current?.focus(), 100)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('')
      
      setText(transcript)
      
      // 如果是最终结果，自动提交
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false)
        handleSubmit(transcript)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      
      // 如果是权限问题或不支持，切换到文字模式
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMode('text')
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [handleSubmit])

  // 停止语音识别
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  // 切换到文字模式
  const switchToTextMode = useCallback(() => {
    setMode('text')
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // 切换到语音模式
  const switchToVoiceMode = useCallback(() => {
    setMode('voice')
    setText('')
  }, [])

  return (
    <div className="voice-input-container fixed bottom-0 left-0 right-0 z-40 safe-area-bottom">
      {/* 结果提示 - 显示在输入框上方 */}
      {result && (
        <div className="px-4 pb-2">
          <div
            className={`px-4 py-3 rounded-2xl text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-lg ${
              result.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {result.type === 'success' ? (
              <Check size={18} className="flex-shrink-0" />
            ) : (
              <X size={18} className="flex-shrink-0" />
            )}
            <span className="font-medium">{result.message}</span>
          </div>
        </div>
      )}

      {/* 正在识别的文字 */}
      {isListening && text && (
        <div className="px-4 pb-2">
          <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 shadow-lg text-gray-800 dark:text-gray-100 text-center animate-pulse">
            {text}
          </div>
        </div>
      )}

      {/* 主输入区域 */}
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="px-4 py-3">
          {mode === 'voice' ? (
            // 语音模式 - 大麦克风按钮
            <div className="flex items-center justify-center gap-4">
              {/* 切换到键盘按钮 */}
              <button
                onClick={switchToTextMode}
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="切换到键盘输入"
              >
                <Keyboard size={22} />
              </button>

              {/* 语音按钮 */}
              {isLoading ? (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Loader2 size={32} className="text-white animate-spin" />
                </div>
              ) : isListening ? (
                <button
                  onClick={stopListening}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg animate-pulse"
                >
                  <div className="w-6 h-6 bg-white rounded-sm" />
                </button>
              ) : (
                <button
                  onClick={startListening}
                  disabled={!speechSupported}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${
                    speechSupported
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  title={speechSupported ? '点击说话' : '此浏览器不支持语音识别，请切换到键盘模式'}
                >
                  <Mic size={32} className="text-white" />
                </button>
              )}

              {/* 占位 - 保持按钮居中 */}
              <div className="w-12 h-12" />
            </div>
          ) : (
            // 文字模式 - 输入框
            <div className="flex items-center gap-3 bg-gray-100/80 dark:bg-gray-800/80 rounded-full px-4 py-2">
              {/* 切换到语音按钮 */}
              <button
                onClick={switchToVoiceMode}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                title="切换到语音输入"
              >
                <Mic size={16} className="text-white" />
              </button>
              
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="说说宝宝做了什么..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base min-w-0"
              />
              
              <button
                onClick={() => handleSubmit()}
                disabled={!text.trim() || isLoading}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  !text.trim() || isLoading
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-400'
                    : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
                }`}
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          )}

          {/* 提示文字和语音示例 */}
          <div className="mt-2">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-500 mx-auto hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <span>
                {mode === 'voice' 
                  ? (speechSupported ? '点击麦克风说话' : '点击键盘图标切换到文字输入')
                  : '输入宝宝活动'
                }
              </span>
              {showExamples ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            {/* 语音输入示例 */}
            {showExamples && (
              <div className="mt-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                  语音输入示例
                </p>
                <div className="space-y-2">
                  {VOICE_INPUT_EXAMPLES.map((section) => (
                    <div key={section.category}>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {section.category}：
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {section.examples.map((example, idx) => (
                          <span key={example}>
                            &ldquo;{example}&rdquo;
                            {idx < section.examples.length - 1 && '、'}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
