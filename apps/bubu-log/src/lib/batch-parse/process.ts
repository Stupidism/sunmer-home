import type { ActivityType, MilkSource, PoopColor, PeeAmount, SpitUpType, SupplementType } from '@/types/activity'

// Deepseek API configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_BATCH_TIMEOUT_MS || 30000)

/** A single message entry from the user (WeChat paste). */
export interface BatchEntry {
  text: string
  localTime: string
}

/** One parsed activity returned by the AI. */
export interface BatchParsedItem {
  action: 'create' | 'update' | 'skip'
  type: ActivityType
  startTime: string // ISO 8601
  endTime: string | null
  milkAmount: number | null
  milkSource: MilkSource | null
  duration: number | null // minutes
  hasPoop: boolean | null
  hasPee: boolean | null
  poopColor: PoopColor | null
  peeAmount: PeeAmount | null
  spitUpType: SpitUpType | null
  supplementType: SupplementType | null
  count: number | null
  notes: string | null
  skipReason: string | null
  originalTexts: string[]
}

/** Result from the batch-parse AI call. */
export interface BatchParseResult {
  items: BatchParsedItem[]
}

/** Error shape from AI. */
export interface BatchParseError {
  error: string
}

const SYSTEM_PROMPT = `你是一个宝宝活动记录助手。用户会粘贴一批微信聊天消息（带时间戳），你需要整体分析所有消息，识别活动、配对开始/结束事件、处理取消，返回一组结构化数据。

## 活动类型 (type)
- SLEEP: 睡觉/入睡/睡着/醒了/睡眠
- DIAPER: 换尿布/尿布/大便/小便/拉屎/拉粑粑/便便
- BREASTFEED: 亲喂/母乳直接喂（非奶瓶）
  【纠错】清胃/青喂/亲为/亲味/清味/轻味 → 亲喂
- BOTTLE: 瓶喂/喝奶/奶瓶/喝了XX毫升
  【奶源 milkSource】BREAST_MILK(母乳,默认) / FORMULA(奶粉/配方奶)
- PUMP: 吸奶/泵奶/挤奶（妈妈吸奶，记录时长和奶量）
- SPIT_UP: 吐奶/吐了/喷奶 (spitUpType: PROJECTILE默认 / NORMAL普通)
- SUPPLEMENT: 补剂/AD/D3 (supplementType: AD / D3)
- HEAD_LIFT: 抬头/趴着/俯卧
- PASSIVE_EXERCISE: 被动操/体操
- ROLL_OVER: 翻身（计数，默认3次）
- PULL_TO_SIT: 拉坐（计数，默认3次）
- GAS_EXERCISE: 排气操/排气/蹬腿
- BATH: 洗澡/沐浴
- OUTDOOR: 户外/晒太阳/出门/遛弯/户外运动
- EARLY_EDUCATION: 早教/读书/玩耍

## 便便属性
- poopColor: YELLOW/GREEN/BROWN/BLACK/WHITE/RED
- peeAmount: SMALL/MEDIUM/LARGE
- hasPoop / hasPee: boolean

## 配对规则（非常重要）
1. "宝宝睡觉了" + 后面的"宝宝醒了" → 合并为一条 SLEEP（action: create, startTime=睡觉时间, endTime=醒了时间）
2. "开始喝奶/喂奶/亲喂" + "喝了XXml结束/喝完了" → 合并为一条 BOTTLE/BREASTFEED
3. "开始XXX" + 后面的"取消" → 两条消息都忽略（action: skip, skipReason 说明原因）
4. 单独的"醒了"（前面没有配对的"睡觉了"）→ action: update（需要匹配系统中未关闭的睡眠记录）
5. 如果两条消息内容相似且时间接近（如"吸奶10分钟"和"吸奶10分钟160毫升"），后一条是更正/补充，只保留后一条（前一条 skip）
6. "取消"/"没吃"/"算了" 等取消意图的消息，应该回溯取消最近的相关活动

## 时间解析规则
- 每条消息都有发送时间（格式 "YYYY-MM-DD HH:mm"）
- 默认使用消息发送时间作为活动时间
- 但如果消息内容中提到了具体时间（如"11:00睡觉了"），要用消息中说的时间，而不是发送时间
- 所有时间用北京时间（UTC+8），输出为 ISO 8601 格式（带 +08:00）
- 瞬时事件（DIAPER/SUPPLEMENT/SPIT_UP/ROLL_OVER/PULL_TO_SIT）：startTime = endTime

## duration 字段
- 如果消息中提到了时长（如"吸奶10分钟"），设置 duration 为分钟数
- 如果有 startTime 和 endTime，duration 可以从中计算
- 否则为 null

## 返回格式
返回一个 JSON 数组，每条包含：
{
  "action": "create" | "update" | "skip",
  "type": "活动类型",
  "startTime": "ISO 8601",
  "endTime": "ISO 8601 或 null",
  "milkAmount": 数字或null,
  "milkSource": "BREAST_MILK"/"FORMULA"/null,
  "duration": 分钟数或null,
  "hasPoop": boolean或null,
  "hasPee": boolean或null,
  "poopColor": "颜色"或null,
  "peeAmount": "量"或null,
  "spitUpType": "PROJECTILE"/"NORMAL"/null,
  "supplementType": "AD"/"D3"/null,
  "count": 数字或null,
  "notes": "备注"或null,
  "skipReason": "跳过原因"或null (仅 action=skip 时),
  "originalTexts": ["原始消息1", "原始消息2"]
}

## 重要
- 只返回 JSON 数组，不要其他内容
- originalTexts 包含这条结果对应的所有原始消息文本
- 每条原始消息最终只能出现在一个结果的 originalTexts 中
- 不要遗漏任何消息，每条消息都要有归属`

interface DeepseekMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Send all entries to Deepseek in a single request for holistic parsing.
 */
export async function batchParseWithAI(entries: BatchEntry[]): Promise<BatchParsedItem[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY environment variable is not set')
  }

  // Format messages for the AI
  const formattedMessages = entries
    .map((e) => `[${e.localTime}] ${e.text}`)
    .join('\n')

  const messages: DeepseekMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `请分析以下微信聊天记录，识别所有宝宝活动并返回结构化数据：\n\n${formattedMessages}`,
    },
  ]

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.1,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Deepseek batch parse timed out after ${DEEPSEEK_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Deepseek API error: ${response.status} - ${errorText}`)
  }

  const data: DeepseekResponse = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from Deepseek')
  }

  // Parse JSON response, stripping markdown fences if present
  const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
  const parsed: unknown = JSON.parse(jsonStr)

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array')
  }

  return parsed as BatchParsedItem[]
}
