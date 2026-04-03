import { ActivityType, PoopColor, PeeAmount, type SpitUpType, type MilkSource, type SupplementType, SupplementTypeLabels } from '@/types/activity'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'

// Deepseek API configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 15000)
const VOICE_INPUT_TIMEOUT_MESSAGE = '语音解析超时，请按左边的时间轴手动添加事件。'

// System prompt for parsing baby activity from natural language
const SYSTEM_PROMPT = `你是一个宝宝活动记录助手。用户会用自然语言描述宝宝的活动，你需要解析并返回结构化的 JSON 数据。

可用的活动类型 (type):
- SLEEP: 睡眠/睡觉/入睡/睡醒/睡着/醒了
- DIAPER: 换尿布/尿布/大便/小便/拉屎/拉粑粑/尿尿/便便
- BREASTFEED: 亲喂/母乳/吃奶（妈妈喂）/喂奶（非奶瓶）
  【语音识别纠错】：清胃/青喂/亲为/青为/亲味/清味/清位/亲位/青位 → 都是"亲喂"的误识别，应解析为 BREASTFEED
- BOTTLE: 瓶喂/奶瓶/喝奶/吃奶（奶瓶）/配方奶/母乳瓶喂
  【奶源类型 milkSource】：
    * BREAST_MILK: 母乳（默认，如"瓶喂母乳"、"喝母乳"）
    * FORMULA: 奶粉/配方奶（如"喝奶粉"、"配方奶"、"奶粉瓶喂"）
  【语音识别纠错】："平喂"/"瓶为"/"瓶味" → "瓶喂" (BOTTLE)
- PUMP: 吸奶/泵奶/挤奶（妈妈吸奶，记录时长和奶量）
  【语音识别纠错】："吸了"/"挤了" 后面跟奶量 → 应解析为 PUMP
- SPIT_UP: 吐奶/吐了/吐出来/喷奶/喷射性吐奶
  【吐奶类型】：默认为喷射性吐奶(PROJECTILE)，如果用户说"普通吐奶"/"轻微吐奶"/"溢奶"则为普通吐奶(NORMAL)
- HEAD_LIFT: 抬头/趴着/俯卧/趴趴
- PASSIVE_EXERCISE: 被动操/体操/运动操
- ROLL_OVER: 翻身/翻/翻个身（计数类活动，需要记录次数）
  【语音识别纠错】：反身/番身/翻生 → "翻身"的误识别，应解析为 ROLL_OVER
- PULL_TO_SIT: 拉坐/拉起来/拉着坐（计数类活动，需要记录次数）
  【语音识别纠错】：拉作/拉做/拉座 → "拉坐"的误识别，应解析为 PULL_TO_SIT
- GAS_EXERCISE: 排气操/排气/蹬腿
- BATH: 洗澡/沐浴/泡澡
- OUTDOOR: 户外/晒太阳/出门/外面/遛弯
- EARLY_EDUCATION: 早教/读书/讲故事/玩耍/游戏/听音乐
- SUPPLEMENT: 补剂/维生素/AD/D3/益生菌/益生元
  【补剂类型 supplementType】：
    * AD: 维生素AD（如"吃了AD"、"补AD"）
    * D3: 维生素D3（如"吃了D3"、"补D3"）
    * PROBIOTICS: 益生菌（如"吃了益生菌"、"补益生菌"）
    * PREBIOTICS: 益生元（如"吃了益生元"、"补益生元"）
  【语音识别纠错】："一生菌"/"易生菌"/"异生菌" → "益生菌" (PROBIOTICS)；"一生元"/"易生元"/"异生元" → "益生元" (PREBIOTICS)

便便颜色 (poopColor):
- YELLOW: 黄色
- GREEN: 绿色
- BROWN: 棕色/褐色
- BLACK: 黑色
- WHITE: 白色
- RED: 红色

小便量 (peeAmount):
- SMALL: 少/一点点
- MEDIUM: 中/一般/正常
- LARGE: 多/很多

请根据用户输入返回以下 JSON 格式（只返回 JSON，不要其他内容）：
{
  "type": "活动类型",
  "startTime": "ISO 8601 时间字符串（北京时间，如 2024-01-22T13:30:00+08:00），活动开始时间",
  "endTime": "ISO 8601 时间字符串（北京时间），活动结束时间，如果没提到或正在进行返回 null",
  "milkAmount": 奶量（毫升），如果没提到返回 null,
  "milkSource": "奶源类型（BREAST_MILK母乳/FORMULA奶粉）"，仅当type为BOTTLE时返回，默认BREAST_MILK,
  "hasPoop": 是否有大便（布尔值），如果没提到返回 null,
  "hasPee": 是否有小便（布尔值），如果没提到返回 null,
  "poopColor": "便便颜色"，如果没提到返回 null,
  "peeAmount": "小便量"，如果没提到返回 null,
  "supplementType": "补剂类型（AD/D3/PROBIOTICS/PREBIOTICS）"，仅当type为SUPPLEMENT时返回，默认AD,
  "spitUpType": "吐奶类型（PROJECTILE喷射性/NORMAL普通）"，仅当type为SPIT_UP时返回，默认PROJECTILE,
  "count": 次数（整数），仅当type为ROLL_OVER或PULL_TO_SIT时使用，如果没提到默认为3,
  "notes": "用户提到的其他备注信息",
  "confidence": 0-1 之间的置信度，表示你对解析结果的信心
}

重要规则：
1. 如果无法确定活动类型，返回 {"error": "无法识别活动类型", "originalText": "用户原文"}
2. 【睡眠记录的特殊规则 - 非常重要】：
   - 当用户说"睡了X分钟"、"睡了X小时"、"刚睡了X分钟"时，表示宝宝刚刚睡醒，这是一个已完成的睡眠记录
   - 此时需要计算 startTime = 当前时间 - X分钟，endTime = 当前时间
   - 例如：用户在北京时间 10:00 说"睡了30分钟" → startTime = 09:30, endTime = 10:00
   - 例如：用户在北京时间 15:30 说"睡了2小时" → startTime = 13:30, endTime = 15:30
   - 只有当用户明确说"入睡"、"开始睡"、"睡着了"时，才是记录入睡时间（此时 endTime 为 null）
3. 时间解析规则（核心规则）：
   【基础规则】
   - 所有时间都是北京时间（东八区，UTC+8）
   - 所有时间输出必须采用 24 小时制（00:00-23:59），禁止使用 12 小时制
   - 返回的 ISO 时间字符串应保留时区信息
   
   【时间段定义 - 用于解析模糊时间】
   - "凌晨/夜里" = 00:00-06:00
   - "早上/上午" = 06:00-12:00
   - "中午" = 11:00-13:00
   - "下午" = 12:00-18:00
   - "傍晚" = 17:00-19:00
   - "晚上" = 18:00-24:00
   
   【具体时间解析 - 非常重要】
   - 当用户说"X点"时，根据当前时间选择最近的过去时间：
     * 用户当前时间 14:20，说"一点"→ 13:00（今天下午1点，最近的过去）
     * 用户当前时间 10:20，说"一点"→ 01:00（今天凌晨1点，最近的过去）
     * 用户当前时间 00:30，说"一点"→ 昨天 13:00（昨天下午1点，最近的过去）
   - 当用户明确说"上午X点"/"早上X点" → 使用 06:00-11:59 范围
   - 当用户明确说"下午X点" → 使用 12:00-17:59 范围（下午1点=13:00）
   - 当用户明确说"晚上X点" → 使用 18:00-23:59 范围（晚上8点=20:00）
   - 当用户明确说"凌晨X点"/"夜里X点" → 使用 00:00-05:59 范围
   
   【相对时间解析】
   - "刚才"、"刚刚" = 当前时间往前 5 分钟
   - "X分钟前" = 当前时间往前 X 分钟
   - "X小时前" = 当前时间往前 X 小时
   
   【时间范围解析 "A到B" - 非常重要】
   - 格式 "A到B" 或 "A至B"：A 是开始时间，B 是结束时间
   - startTime = A，endTime = B，绝对不能搞反！
   - 解析时两个时间都要选择最合理的过去时间
   - 示例（假设当前时间 14:20）：
     * "一点到一点半" → startTime = 13:00, endTime = 13:30（刚结束的活动）
     * "一点二十到一点半" → startTime = 13:20, endTime = 13:30
     * "8点10分到9点" → startTime = 08:10, endTime = 09:00（今天上午）
     * "下午3点到4点半" → 无法解析为过去时间，返回低置信度
   - 注意：如果时间范围在未来，应降低置信度并提示用户确认
4. 如果用户说"喝奶"但没说是亲喂还是瓶喂，默认为 BOTTLE（瓶喂）
5. 如果用户说"换尿布"但没说大小便情况，hasPoop 都设为 null, hasPee 设为 true
6. 【置信度规则 - 非常重要】：
   - 置信度范围 0-1，表示你对解析结果的信心
   - 高置信度 (0.8-1.0)：信息完整明确，如"喝了80毫升奶瓶"、"亲喂15分钟"、"换尿布有大便黄色"
   - 中等置信度 (0.6-0.8)：部分信息缺失但能推断，如"瓶喂了"（没说奶量）、"睡了一会"（没说具体时长）
   - 低置信度 (0.3-0.6)：信息模糊需要确认，如：
     * "喝奶"、"吃奶" - 没说亲喂/瓶喂，没说奶量
     * "换尿布" - 没说大小便情况
     * "睡觉" - 没说入睡还是睡醒，没说时长
   - 很低置信度 (<0.3)：无法准确判断活动类型
7. 【语音识别纠错 - 重要】：
   - 用户输入来自语音转文字，可能有同音字/近音字错误
   - 常见误识别：
     * "清胃"/"青喂"/"亲为"/"亲味" → "亲喂" (BREASTFEED)
     * "平喂"/"瓶为"/"瓶味" → "瓶喂" (BOTTLE)
     * "排起操"/"排弃操" → "排气操" (GAS_EXERCISE)
     * "被动草"/"被懂操" → "被动操" (PASSIVE_EXERCISE)
     * "反身"/"番身"/"翻生" → "翻身" (ROLL_OVER)
     * "拉作"/"拉做"/"拉座" → "拉坐" (PULL_TO_SIT)
     * "洗脚"（在宝宝语境下）→ 可能是"洗澡" (BATH)
   - 请智能纠正这些语音识别错误，正确理解用户意图
8. 【计数类活动规则 - 翻身/拉坐】：
   - ROLL_OVER（翻身）和 PULL_TO_SIT（拉坐）是计数类活动
   - 这类活动的 startTime 和 endTime 应该相同（瞬时事件）
   - 需要记录 count（次数），如果用户没有明确说次数，默认为 3
   - 示例：
     * "翻身3次" → type=ROLL_OVER, count=3, startTime=endTime=当前时间
     * "拉坐5次" → type=PULL_TO_SIT, count=5, startTime=endTime=当前时间
     * "翻身" → type=ROLL_OVER, count=3（默认）, startTime=endTime=当前时间`

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

export interface ParsedActivity {
  type: ActivityType
  startTime: string | null
  endTime: string | null
  milkAmount: number | null
  milkSource: MilkSource | null
  hasPoop: boolean | null
  hasPee: boolean | null
  poopColor: PoopColor | null
  peeAmount: PeeAmount | null
  supplementType: SupplementType | null
  spitUpType: SpitUpType | null
  count: number | null
  notes: string | null
  confidence: number
}

export interface ParseError {
  error: string
  originalText: string
}

class DeepseekTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Deepseek request timed out after ${timeoutMs}ms`)
    this.name = 'DeepseekTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export interface ProcessVoiceInputOptions {
  text: string
  localTime?: string | null
  babyId: string
  userId?: string | null
  confirmationBaseUrl?: string | null
}

export interface ProcessVoiceInputResult {
  status: number
  body: Record<string, unknown>
}

type NonSuccessLogInput = {
  status: number
  code: string
  text: string
  babyId: string | null
  userId: string | null
  details?: string
  needConfirmation?: boolean
  submissionId?: string | null
  confidence?: number | null
}

function logNonSuccess(input: NonSuccessLogInput) {
  console.warn('[voice-input][non-success]', {
    status: input.status,
    code: input.code,
    babyId: input.babyId,
    userId: input.userId,
    text: input.text,
    details: input.details ?? null,
    needConfirmation: input.needConfirmation ?? false,
    submissionId: input.submissionId ?? null,
    confidence: input.confidence ?? null,
  })
}

export async function callDeepseek(text: string, userLocalTime: string): Promise<ParsedActivity | ParseError> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY environment variable is not set')
  }

  const messages: DeepseekMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `用户当前本地时间: ${userLocalTime}\n用户输入: ${text}` }
  ]

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.1, // Low temperature for more consistent parsing
        max_tokens: 500
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DeepseekTimeoutError(DEEPSEEK_TIMEOUT_MS)
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

  // Parse the JSON response
  try {
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(jsonStr)
  } catch {
    throw new Error(`Failed to parse Deepseek response: ${content}`)
  }
}

// Confidence threshold - below this, require user confirmation
const CONFIDENCE_THRESHOLD = 0.75

// Type labels for audit log
const typeLabelsForLog: Record<ActivityType, string> = {
  [ActivityType.SLEEP]: '睡眠',
  [ActivityType.DIAPER]: '换尿布',
  [ActivityType.BREASTFEED]: '亲喂',
  [ActivityType.BOTTLE]: '瓶喂',
  [ActivityType.PUMP]: '吸奶',
  [ActivityType.HEAD_LIFT]: '抬头',
  [ActivityType.PASSIVE_EXERCISE]: '被动操',
  [ActivityType.ROLL_OVER]: '翻身',
  [ActivityType.PULL_TO_SIT]: '拉坐',
  [ActivityType.GAS_EXERCISE]: '排气操',
  [ActivityType.BATH]: '洗澡',
  [ActivityType.OUTDOOR]: '户外',
  [ActivityType.EARLY_EDUCATION]: '早教',
  [ActivityType.SUPPLEMENT]: '补剂',
  [ActivityType.SPIT_UP]: '吐奶',
}

// Parse voice input and create activity
export async function processVoiceInput(options: ProcessVoiceInputOptions): Promise<ProcessVoiceInputResult> {
  const { text, localTime, babyId, userId = null, confirmationBaseUrl = null } = options

  try {
    if (!text || typeof text !== 'string') {
      logNonSuccess({
        status: 400,
        code: 'MISSING_TEXT',
        text: String(text ?? ''),
        babyId,
        userId,
        details: 'missing text payload',
      })
      return {
        status: 400,
        body: { error: '请提供语音文本内容', code: 'MISSING_TEXT' },
      }
    }

    if (!babyId) {
      logNonSuccess({
        status: 400,
        code: 'MISSING_BABY_ID',
        text,
        babyId: null,
        userId,
        details: 'missing baby id',
      })
      return {
        status: 400,
        body: { error: '请提供宝宝ID', code: 'MISSING_BABY_ID' },
      }
    }

    const payload = await getPayloadClient()

    // Use provided localTime or fallback to server time
    // localTime should be in format like "2024-01-22 15:30" (user's local time)
    const userLocalTime = localTime || new Date().toISOString()

    // Parse the text using Deepseek
    const parsed = await callDeepseek(text, userLocalTime)

    // Check if parsing failed
    if ('error' in parsed) {
      // Record failed audit log
      await createAuditLog(payload, {
        action: 'CREATE',
        resourceId: null,
        inputMethod: 'VOICE',
        inputText: text,
        description: `语音: "${text}" - ${parsed.error}`,
        success: false,
        errorMessage: parsed.error,
        beforeData: null,
        afterData: null,
        activityId: null,
        babyId,
        userId,
      })

      logNonSuccess({
        status: 400,
        code: 'PARSE_FAILED',
        text,
        babyId,
        userId,
        details: parsed.error,
      })

      return {
        status: 400,
        body: {
          error: parsed.error, 
          originalText: parsed.originalText,
          code: 'PARSE_FAILED'
        },
      }
    }

    // Validate activity type
    if (!Object.values(ActivityType).includes(parsed.type)) {
      // Record failed audit log
      await createAuditLog(payload, {
        action: 'CREATE',
        resourceId: null,
        inputMethod: 'VOICE',
        inputText: text,
        description: `语音: "${text}" - 无效类型`,
        success: false,
        errorMessage: `无效的活动类型: ${parsed.type}`,
        beforeData: null,
        afterData: null,
        activityId: null,
        babyId,
        userId,
      })

      logNonSuccess({
        status: 400,
        code: 'INVALID_TYPE',
        text,
        babyId,
        userId,
        details: String(parsed.type),
      })

      return {
        status: 400,
        body: {
          error: `无效的活动类型: ${parsed.type}`,
          code: 'INVALID_TYPE'
        },
      }
    }

    // Use current time if not specified
    const startTime = parsed.startTime 
      ? new Date(parsed.startTime)
      : new Date()
    
    // Point events (no duration): startTime = endTime
    const POINT_EVENT_TYPES = ['DIAPER', 'SUPPLEMENT', 'SPIT_UP', 'ROLL_OVER', 'PULL_TO_SIT']
    const isPointEvent = POINT_EVENT_TYPES.includes(parsed.type)
    const endTime = isPointEvent
      ? startTime
      : (parsed.endTime ? new Date(parsed.endTime) : null)

    // If confidence is low, return parsed data for confirmation
    if (parsed.confidence < CONFIDENCE_THRESHOLD) {
      // Record low confidence audit log (still counts as needing confirmation)
      const typeLabel = typeLabelsForLog[parsed.type] || parsed.type
      const pendingSubmission = await createAuditLog(payload, {
        action: 'CREATE',
        resourceId: null,
        inputMethod: 'VOICE',
        inputText: text,
        description: `语音: "${text}" - 待确认${typeLabel}`,
        success: false,
        beforeData: null,
        afterData: parsed,
        activityId: null,
        babyId,
        userId,
      })

      const submissionId =
        pendingSubmission && typeof pendingSubmission === 'object' && 'id' in pendingSubmission
          ? String(pendingSubmission.id)
          : null
      const confirmationUrl = buildConfirmationUrl(confirmationBaseUrl, submissionId)

      logNonSuccess({
        status: 200,
        code: 'NEED_CONFIRMATION',
        text,
        babyId,
        userId,
        details: `low confidence: ${parsed.confidence}`,
        needConfirmation: true,
        submissionId,
        confidence: parsed.confidence,
      })

      return {
        status: 200,
        body: {
          success: false,
          code: 'NEED_CONFIRMATION',
          needConfirmation: true,
          submissionId,
          confirmationUrl,
          parsed: {
            type: parsed.type,
            startTime: startTime.toISOString(),
            endTime: endTime?.toISOString() || null,
            milkAmount: parsed.milkAmount,
            milkSource: parsed.milkSource,
            hasPoop: parsed.hasPoop,
            hasPee: parsed.hasPee,
            poopColor: parsed.poopColor,
            peeAmount: parsed.peeAmount,
            supplementType: parsed.supplementType,
            spitUpType: parsed.spitUpType,
            count: parsed.count,
            notes: parsed.notes,
            confidence: parsed.confidence,
            originalText: text
          },
          message: `识别为: ${generateConfirmationMessage(parsed)}，请确认`
        },
      }
    }

    // Create the activity
    const activity = await payload.create({
      collection: 'activities',
      data: {
        type: parsed.type,
        startTime: startTime.toISOString(),
        endTime: endTime ? endTime.toISOString() : null,
        babyId,
        milkAmount: parsed.milkAmount,
        milkSource: parsed.milkSource,
        hasPoop: parsed.hasPoop,
        hasPee: parsed.hasPee,
        poopColor: parsed.poopColor,
        peeAmount: parsed.peeAmount,
        supplementType: parsed.supplementType,
        spitUpType: parsed.spitUpType,
        count: parsed.count,
        notes: parsed.notes,
      },
      depth: 0,
      overrideAccess: true,
    })

    // Generate description for successful audit log
    const typeLabel = typeLabelsForLog[parsed.type] || parsed.type
    const description = `语音: "${text}" - 创建${typeLabel}`

    // Record audit log for voice input
    await createAuditLog(payload, {
      action: 'CREATE',
      resourceId: String(activity.id),
      inputMethod: 'VOICE',
      inputText: text,
      description,
      success: true,
      beforeData: null,
      afterData: activity,
      activityId: String(activity.id),
      babyId,
      userId,
    })

    // Return success with activity details and parse info
    return {
      status: 201,
      body: {
        success: true,
        needConfirmation: false,
        submissionId: null,
        confirmationUrl: null,
        activity,
        parsed: {
          confidence: parsed.confidence,
          originalText: text
        },
        message: generateConfirmationMessage(parsed)
      },
    }

  } catch (error) {
    console.error('Voice input processing failed:', error)

    if (error instanceof DeepseekTimeoutError) {
      const timeoutDetails = `Deepseek timed out after ${error.timeoutMs}ms`

      try {
        if (text) {
          const payload = await getPayloadClient()
          await createAuditLog(payload, {
            action: 'CREATE',
            resourceId: null,
            inputMethod: 'VOICE',
            inputText: text,
            description: `语音: "${text}" - 语音解析超时`,
            success: false,
            errorMessage: timeoutDetails,
            beforeData: null,
            afterData: null,
            activityId: null,
            babyId,
            userId,
          })
        }
      } catch {
        // Ignore audit log errors
      }

      logNonSuccess({
        status: 504,
        code: 'DEEPSEEK_TIMEOUT',
        text,
        babyId,
        userId,
        details: timeoutDetails,
      })

      return {
        status: 504,
        body: {
          error: VOICE_INPUT_TIMEOUT_MESSAGE,
          details: timeoutDetails,
          code: 'DEEPSEEK_TIMEOUT',
        },
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Try to record the error in audit log
    try {
      if (text) {
        const payload = await getPayloadClient()
        await createAuditLog(payload, {
          action: 'CREATE',
          resourceId: null,
          inputMethod: 'VOICE',
          inputText: text,
          description: `语音: "${text}" - 处理失败`,
          success: false,
          errorMessage,
          beforeData: null,
          afterData: null,
          activityId: null,
          babyId,
          userId,
        })
      }
    } catch {
      // Ignore audit log errors
    }

    logNonSuccess({
      status: 500,
      code: 'PROCESSING_ERROR',
      text,
      babyId,
      userId,
      details: errorMessage,
    })
    
    return {
      status: 500,
      body: {
        error: '处理语音输入失败',
        details: errorMessage,
        code: 'PROCESSING_ERROR'
      },
    }
  }
}

function buildConfirmationUrl(baseUrl: string | null, submissionId: string | null): string | null {
  if (!baseUrl || !submissionId) {
    return null
  }

  try {
    const url = new URL('/', baseUrl)
    url.searchParams.set('submission_id', submissionId)
    return url.toString()
  } catch {
    return null
  }
}

// Calculate duration in minutes from startTime and endTime
function calculateDuration(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null
  const start = new Date(startTime)
  const end = new Date(endTime)
  return Math.round((end.getTime() - start.getTime()) / (60 * 1000))
}

// Generate a human-readable confirmation message
function generateConfirmationMessage(parsed: ParsedActivity): string {
  const typeLabels: Record<ActivityType, string> = {
    [ActivityType.SLEEP]: '睡眠',
    [ActivityType.DIAPER]: '换尿布',
    [ActivityType.BREASTFEED]: '亲喂',
    [ActivityType.BOTTLE]: '瓶喂',
    [ActivityType.PUMP]: '吸奶',
    [ActivityType.HEAD_LIFT]: '抬头',
    [ActivityType.PASSIVE_EXERCISE]: '被动操',
    [ActivityType.ROLL_OVER]: '翻身',
    [ActivityType.PULL_TO_SIT]: '拉坐',
    [ActivityType.GAS_EXERCISE]: '排气操',
    [ActivityType.BATH]: '洗澡',
    [ActivityType.OUTDOOR]: '户外',
    [ActivityType.EARLY_EDUCATION]: '早教',
    [ActivityType.SUPPLEMENT]: '补剂',
    [ActivityType.SPIT_UP]: '吐奶',
  }

  const milkSourceLabels: Record<string, string> = {
    BREAST_MILK: '母乳',
    FORMULA: '奶粉',
  }

  let message = `已记录: ${typeLabels[parsed.type]}`

  // Show supplement type
  if (parsed.type === ActivityType.SUPPLEMENT && parsed.supplementType) {
    message += `（${SupplementTypeLabels[parsed.supplementType] || parsed.supplementType}）`
  }

  // For count-based activities, show count instead of duration
  if (parsed.count && (parsed.type === ActivityType.ROLL_OVER || parsed.type === ActivityType.PULL_TO_SIT)) {
    message += `，${parsed.count} 次`
  } else {
    const duration = calculateDuration(parsed.startTime, parsed.endTime)
    if (duration) {
      message += `，时长 ${duration} 分钟`
    }
  }

  if (parsed.milkAmount) {
    message += `，${parsed.milkAmount} 毫升`
  }

  // Show milk source for bottle feeding
  if (parsed.type === ActivityType.BOTTLE && parsed.milkSource) {
    message += `（${milkSourceLabels[parsed.milkSource] || parsed.milkSource}）`
  }

  if (parsed.hasPoop || parsed.hasPee) {
    const parts = []
    if (parsed.hasPoop) parts.push('大便')
    if (parsed.hasPee) parts.push('小便')
    message += `，有${parts.join('和')}`
  }

  return message
}
