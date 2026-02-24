'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { X, Mic, Keyboard, Send, Loader2, Check, Calendar } from 'lucide-react'
import { ActivityType } from '@/types/activity'
import { useQueryClient } from '@tanstack/react-query'
import { useModalParams, activityTypeToModalType, type ModalType } from '@/hooks/useModalParams'
import { dayjs } from '@/lib/dayjs'
import { withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

// Parsed voice input data for confirmation
export interface VoiceParsedData {
  type: ActivityType
  startTime: string
  endTime: string | null
  milkAmount: number | null
  hasPoop: boolean | null
  hasPee: boolean | null
  poopColor: string | null
  peeAmount: string | null
  notes: string | null
  confidence: number
  originalText: string
}

interface VoiceInputResponse {
  success: boolean
  message: string
  code?: string
  needConfirmation?: boolean
  parsed?: VoiceParsedData
  activity?: {
    id: string
    type: string
  }
  error?: string
}

interface ActivityFABProps {
  onVoiceSuccess?: (message: string) => void
  onVoiceError?: (message: string) => void
  /** 目标日期（用于语音输入，默认为今天）*/
  targetDate?: Date
}

export function ActivityFAB({ 
  onVoiceSuccess,
  onVoiceError,
  targetDate,
}: ActivityFABProps) {
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const [isAndroid, setIsAndroid] = useState(false)
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const manualStopRef = useRef(false)  // 标记是否是用户手动停止
  const queryClient = useQueryClient()
  
  const { openModal } = useModalParams()

  // 检查目标日期是否不是今天
  const isNotToday = useMemo(() => {
    if (!targetDate) return false
    const today = dayjs().startOf('day')
    const target = dayjs(targetDate).startOf('day')
    return !target.isSame(today)
  }, [targetDate])

  const targetDateStr = useMemo(() => {
    if (!targetDate || !isNotToday) return null
    return dayjs(targetDate).format('M月D日')
  }, [targetDate, isNotToday])

  // 检查是否支持语音识别
  useEffect(() => {
    const userAgent = window.navigator.userAgent || ''
    setIsAndroid(/android/i.test(userAgent))
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(!!SpeechRecognition)
  }, [])

  // 关闭语音面板时重置状态
  useEffect(() => {
    if (!voiceDialogOpen) {
      setText('')
      setResult(null)
      setMode(isAndroid ? 'text' : 'voice')
      setIsListening(false)
      finalTranscriptRef.current = ''
      manualStopRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current)
        submitTimeoutRef.current = null
      }
    }
  }, [voiceDialogOpen, isAndroid])

  // 用于标记是否需要自动开始语音识别
  const shouldAutoStartRef = useRef(false)

  // 关闭语音对话框
  const closeVoiceDialog = useCallback(() => {
    setVoiceDialogOpen(false)
  }, [])

  // 处理语音输入需要确认的情况 - 打开对应的表单弹窗
  const handleNeedConfirmation = useCallback((parsed: VoiceParsedData) => {
    // 确定要打开的弹窗类型
    let modalType: ModalType
    if (parsed.type === ActivityType.SLEEP) {
      // 有 endTime 说明是睡醒（有时长），否则是入睡
      modalType = parsed.endTime ? 'sleep_end' : 'sleep_start'
    } else {
      modalType = activityTypeToModalType[parsed.type]
    }
    
    // 构建初始值参数 - 直接使用 startTime 和 endTime
    const params: Record<string, string> = {
      startTime: parsed.startTime,
    }
    if (parsed.endTime !== null) {
      params.endTime = parsed.endTime
    }
    if (parsed.milkAmount !== null) params.milkAmount = parsed.milkAmount.toString()
    if (parsed.hasPoop !== null) params.hasPoop = parsed.hasPoop.toString()
    if (parsed.hasPee !== null) params.hasPee = parsed.hasPee.toString()
    if (parsed.poopColor !== null) params.poopColor = parsed.poopColor
    if (parsed.peeAmount !== null) params.peeAmount = parsed.peeAmount
    
    openModal(modalType, { params })
  }, [openModal])

  // 提交语音/文字输入
  const handleSubmit = useCallback(async (inputText?: string) => {
    const textToSubmit = inputText || text
    if (!textToSubmit.trim() || isLoading) return

    setIsLoading(true)
    setResult(null)

    try {
      // 发送用户本地时间，格式：2024-01-22 15:30:00
      // 如果提供了 targetDate，使用目标日期但保留当前时间
      const now = new Date()
      let dateToUse = now
      if (targetDate) {
        // 使用目标日期，但保留当前时间（小时分钟秒）
        dateToUse = new Date(targetDate)
        dateToUse.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      }
      const localTime = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}-${String(dateToUse.getDate()).padStart(2, '0')} ${String(dateToUse.getHours()).padStart(2, '0')}:${String(dateToUse.getMinutes()).padStart(2, '0')}:${String(dateToUse.getSeconds()).padStart(2, '0')}`
      
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/voice-input'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSubmit.trim(), localTime }),
      })

      const data: VoiceInputResponse = await response.json()

      if (response.ok && data.needConfirmation) {
        if (data.parsed) {
          setResult({ type: 'success', message: data.message })
          setText('')
          // Close dialog and open form for confirmation
          setTimeout(() => {
            closeVoiceDialog()
            handleNeedConfirmation(data.parsed!)
          }, 500)
        } else {
          const errorMsg = data.error || '需要确认，但缺少解析结果'
          setResult({ type: 'error', message: errorMsg })
          onVoiceError?.(errorMsg)
        }
      } else if (response.ok && data.success) {
        // High confidence - activity was created directly
        setResult({ type: 'success', message: data.message })
        setText('')
        onVoiceSuccess?.(data.message)
        // 使用正确的 queryKey 格式刷新数据
        queryClient.invalidateQueries({ queryKey: ['get', '/activities'] })
        queryClient.invalidateQueries({ queryKey: ['get', '/activities/latest'] })
        // 不关闭弹窗，用户可以继续输入
      } else {
        const errorMsg = data.error || '解析失败'
        setResult({ type: 'error', message: errorMsg })
        onVoiceError?.(errorMsg)
      }
    } catch {
      const errorMsg = '网络错误，请重试'
      setResult({ type: 'error', message: errorMsg })
      onVoiceError?.(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [text, isLoading, onVoiceSuccess, onVoiceError, closeVoiceDialog, queryClient, handleNeedConfirmation, targetDate])

  // 开始语音识别
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // 浏览器不支持语音识别，切换到文字输入
      setResult({ type: 'error', message: '此浏览器不支持语音识别' })
      setMode('text')
      setTimeout(() => inputRef.current?.focus(), 100)
      return
    }

    // 检查是否为 HTTPS（非 localhost）
    if (typeof window !== 'undefined' && 
        window.location.protocol !== 'https:' && 
        !window.location.hostname.includes('localhost') &&
        window.location.hostname !== '127.0.0.1') {
      setResult({ type: 'error', message: '语音识别需要 HTTPS 连接' })
      setMode('text')
      setTimeout(() => inputRef.current?.focus(), 100)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = true  // 持续监听，允许用户说完整句子
      recognition.interimResults = true

      recognition.onstart = () => {
        console.log('Speech recognition started')
        setIsListening(true)
        setResult(null) // 清除之前的错误
        finalTranscriptRef.current = ''
        manualStopRef.current = false  // 开始时重置手动停止标记
      }

      recognition.onresult = (event) => {
        // 清除之前的延迟提交计时器
        if (submitTimeoutRef.current) {
          clearTimeout(submitTimeoutRef.current)
          submitTimeoutRef.current = null
        }

        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        // 累积 final 结果
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript
        }
        
        // 显示当前识别的文字（final + interim）
        setText(finalTranscriptRef.current + interimTranscript)
        
        // 如果有 final 结果，设置延迟提交（1.5秒静默后提交）
        if (finalTranscript && finalTranscriptRef.current.trim()) {
          submitTimeoutRef.current = setTimeout(() => {
            // 如果已经手动停止，不自动提交
            if (manualStopRef.current) {
              return
            }
            const textToSubmit = finalTranscriptRef.current.trim()
            if (textToSubmit) {
              // 停止识别并提交
              recognition.stop()
              setIsListening(false)
              handleSubmit(textToSubmit)
            }
          }, 1500) // 1.5秒静默后自动提交
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        
        // 清除延迟提交计时器
        if (submitTimeoutRef.current) {
          clearTimeout(submitTimeoutRef.current)
          submitTimeoutRef.current = null
        }
        
        // 根据错误类型给出具体提示
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            setResult({ type: 'error', message: '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问' })
            setMode('text')
            setTimeout(() => inputRef.current?.focus(), 100)
            break
          case 'no-speech':
            // 如果有已识别的文字且不是手动停止，自动提交
            if (finalTranscriptRef.current.trim() && !manualStopRef.current) {
              handleSubmit(finalTranscriptRef.current.trim())
            } else if (!finalTranscriptRef.current.trim()) {
              setResult({ type: 'error', message: '没有检测到语音，请靠近麦克风重试' })
            }
            break
          case 'network':
            setResult({ type: 'error', message: '网络错误，语音识别需要网络连接' })
            break
          case 'audio-capture':
            setResult({ type: 'error', message: '无法访问麦克风，请检查设备设置' })
            setMode('text')
            setTimeout(() => inputRef.current?.focus(), 100)
            break
          case 'aborted':
            // 用户取消，不显示错误
            break
          default:
            setResult({ type: 'error', message: `语音识别错误: ${event.error}` })
        }
      }

      recognition.onend = () => {
        console.log('Speech recognition ended')
        setIsListening(false)
        
        // 如果是手动停止，不自动提交（已在 stopListening 中处理）
        if (manualStopRef.current) {
          return
        }
        
        // 如果还有未提交的文字且没有正在处理，提交它
        if (finalTranscriptRef.current.trim() && !submitTimeoutRef.current) {
          handleSubmit(finalTranscriptRef.current.trim())
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      console.log('Speech recognition start() called')
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setResult({ type: 'error', message: `语音识别启动失败: ${errorMessage}` })
      setMode('text')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [handleSubmit])

  // 打开弹窗时自动开始语音识别
  useEffect(() => {
    if (voiceDialogOpen && shouldAutoStartRef.current && speechSupported && mode === 'voice' && !isListening && !isLoading) {
      shouldAutoStartRef.current = false
      // 延迟一点以确保 UI 已渲染
      const timer = setTimeout(() => {
        startListening()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [voiceDialogOpen, speechSupported, mode, isListening, isLoading, startListening])

  // 停止语音识别
  const stopListening = useCallback(() => {
    // 清除延迟提交计时器
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current)
      submitTimeoutRef.current = null
    }
    
    if (recognitionRef.current) {
      // 标记为手动停止，不自动提交
      manualStopRef.current = true
      recognitionRef.current.stop()
      setIsListening(false)
      setMode('text')
      setText(finalTranscriptRef.current.trim())
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <>
      {/* 遮罩层 - 语音输入 */}
      {voiceDialogOpen && (
        <div 
          className="fab-overlay fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
          onClick={closeVoiceDialog}
        />
      )}

      {/* 语音输入对话框 */}
      {voiceDialogOpen && (
        <div className="fab-modal fixed inset-x-0 bottom-24 z-50 px-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-5 max-w-sm mx-auto">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                {mode === 'text' ? (
                  <Keyboard size={20} className="text-violet-500" />
                ) : (
                  <Mic size={20} className="text-violet-500" />
                )}
                {mode === 'text' ? '键盘记录' : '语音记录'}
              </h3>
              <button
                onClick={closeVoiceDialog}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                data-testid="voice-dialog-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* 显示目标日期（如果不是今天） */}
            {isNotToday && targetDateStr && (
              <div className="mb-4 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
                <Calendar size={16} />
                <span>将记录到 <strong>{targetDateStr}</strong></span>
              </div>
            )}

            {/* 结果提示 */}
            {result && (
              <div
                className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
                  result.type === 'success'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}
              >
                {result.type === 'success' ? (
                  <Check size={18} className="flex-shrink-0" />
                ) : (
                  <X size={18} className="flex-shrink-0" />
                )}
                <span className="font-medium">{result.message}</span>
              </div>
            )}

            {/* 语音模式 */}
            {mode === 'voice' ? (
              <div className="text-center">
                {/* 识别中的文字 */}
                {isListening && text && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 animate-pulse">
                    {text}
                  </div>
                )}

                {/* 语音按钮 */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  {isLoading ? (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Loader2 size={36} className="text-white animate-spin" />
                    </div>
                  ) : isListening ? (
                    <button
                      onClick={stopListening}
                      className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg animate-pulse"
                      data-testid="voice-stop-btn"
                    >
                      <div className="w-8 h-8 bg-white rounded-sm" />
                    </button>
                  ) : (
                    <button
                      onClick={startListening}
                      disabled={!speechSupported}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${
                        speechSupported
                          ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                      data-testid="voice-start-btn"
                    >
                      <Mic size={36} className="text-white" />
                    </button>
                  )}
                </div>

                {/* 提示文字 */}
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {isListening ? '正在听...' : speechSupported ? '点击麦克风开始说话' : '此浏览器不支持语音'}
                </p>

                {/* 切换到键盘 */}
                <button
                  onClick={() => {
                    setMode('text')
                    setTimeout(() => inputRef.current?.focus(), 100)
                  }}
                  className="text-sm text-violet-600 dark:text-violet-400 flex items-center gap-1 mx-auto"
                >
                  <Keyboard size={16} />
                  切换到键盘输入
                </button>
              </div>
            ) : (
              /* 文字输入模式 */
              <div>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 mb-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="说说宝宝做了什么..."
                    disabled={isLoading}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 text-base"
                    data-testid="voice-text-input"
                  />
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!text.trim() || isLoading}
                    className={`flex-shrink-0 w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center transition-all ${
                      !text.trim() || isLoading
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-400'
                        : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md hover:shadow-lg'
                    }`}
                    data-testid="voice-submit-btn"
                  >
                    {isLoading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>

                {/* 切换到语音 */}
                {speechSupported && (
                  <button
                    onClick={() => setMode('voice')}
                    className="text-sm text-violet-600 dark:text-violet-400 flex items-center gap-1 mx-auto"
                  >
                    <Mic size={16} />
                    切换到语音输入
                  </button>
                )}
              </div>
            )}

            {/* 示例提示 */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="space-y-1.5 text-xs text-gray-400 dark:text-gray-500">
                <p className="text-center font-medium text-gray-500 dark:text-gray-400">标准语音输入示例：</p>
                <p><span className="text-gray-500 dark:text-gray-400">喂养：</span>&quot;喝了80毫升奶&quot; &quot;亲喂15分钟&quot;</p>
                <p><span className="text-gray-500 dark:text-gray-400">睡眠：</span>&quot;睡了一个小时&quot; &quot;入睡了&quot;</p>
                <p><span className="text-gray-500 dark:text-gray-400">尿布：</span>&quot;换尿布有便便&quot; &quot;大便黄色&quot;</p>
                <p><span className="text-gray-500 dark:text-gray-400">运动：</span>&quot;抬头5分钟&quot; &quot;被动操&quot; &quot;翻身3次&quot; &quot;拉坐&quot;</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 语音输入按钮 - 唯一的 FAB */}
      <button
        onClick={() => {
          if (!voiceDialogOpen) {
            setMode(isAndroid ? 'text' : 'voice')
            // 安卓端默认键盘输入，不自动开始语音识别
            shouldAutoStartRef.current = !isAndroid
            setVoiceDialogOpen(true)
          } else {
            setVoiceDialogOpen(false)
          }
        }}
        className={`fab-button fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          voiceDialogOpen
            ? 'bg-violet-500 scale-110'
            : 'bg-gradient-to-br from-violet-500 to-purple-600 hover:shadow-xl hover:scale-105 active:scale-95'
        }`}
        aria-label={isAndroid ? '键盘输入' : '语音输入'}
        data-testid="voice-fab-btn"
      >
        {isAndroid ? (
          <Keyboard size={24} className="text-white" />
        ) : (
          <Mic size={26} className="text-white" />
        )}
      </button>
    </>
  )
}
