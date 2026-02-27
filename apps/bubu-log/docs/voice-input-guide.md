# 🎤 语音记录功能指南

通过 Siri 或小爱同学，用语音轻松记录宝宝的活动！

## 功能概述

语音记录 API 可以理解自然语言，例如：
- "宝宝喝了80毫升奶" → 自动记录瓶喂，80ml
- "刚换了尿布，有便便，黄色的" → 记录换尿布，有大便，颜色黄色
- "宝宝睡了一个半小时" → 记录睡眠，90分钟
- "做了10分钟排气操" → 记录排气操，10分钟
- "翻身3次" → 记录翻身，3次
- "拉坐5次" → 记录拉坐，5次

## 方案一：iPhone Siri Shortcuts（推荐）

> 最新版本建议使用「用户专属 Bearer Token webhook」：自动绑定当前登录用户和宝宝。

### 设置步骤

1. **打开快捷指令 App**
   - iPhone 上打开「快捷指令」应用

2. **创建新快捷指令**
   - 点击右上角 `+` 创建新指令

3. **添加「听写文本」动作**
   - 搜索并添加「听写文本」
   - 这会让 Siri 监听你说的话

4. **添加「获取 URL 内容」动作**
   - 搜索并添加「获取 URL 内容」
   - 配置如下：
     - **URL**: `https://你的域名.vercel.app/api/webhooks/voice-input`
     - **方法**: POST
     - **请求头**:
       - `Authorization`: `Bearer 你的 SIGNED_WEBHOOK_TOKEN`
     - **请求体**: JSON
     - **JSON 内容**:
       - `text`: 选择「听写文本」变量
       - `localTime`: 建议传当前时间（格式示例：`2026-02-20 21:30`）
       - `babyId`（可选）: 多宝宝场景可在同一条快捷指令里动态传入目标宝宝 ID；不传则使用 token 绑定宝宝

> 注意：`shortcuts://create-shortcut` 只能打开空白编辑器，不能自动填充动作。
> 若要一键安装模板，需使用 iCloud 快捷指令分享链接。

5. **添加「显示结果」动作**
   - 显示 API 返回的确认信息

6. **命名快捷指令**
   - 点击顶部命名，例如「记录宝宝活动」

### 使用方法

对 iPhone 说：
```
"Hey Siri，记录宝宝活动"
```

然后 Siri 会问你要说什么，这时候说：
```
"宝宝刚才喝了60毫升奶"
```

系统会自动解析并记录！

### 快捷指令模板

你可以直接导入这个快捷指令配置：

```json
{
  "WFWorkflowName": "记录宝宝活动",
  "WFWorkflowActions": [
    {
      "WFWorkflowActionIdentifier": "is.workflow.actions.dictatetext",
      "WFWorkflowActionParameters": {}
    },
    {
      "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
      "WFWorkflowActionParameters": {
        "WFURL": "https://你的域名.vercel.app/api/webhooks/voice-input",
        "WFHTTPMethod": "POST",
        "WFHTTPBodyType": "Json",
        "WFJSONValues": {
          "Value": {
            "WFDictionaryFieldValueItems": [
              {
                "WFKey": { "Value": { "string": "text" } },
                "WFValue": {
                  "Value": {
                    "Type": "Variable",
                    "VariableName": "Dictated Text"
                  }
                }
              }
            ]
          }
        }
      }
    },
    {
      "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
      "WFWorkflowActionParameters": {
        "WFDictionaryKey": "message"
      }
    },
    {
      "WFWorkflowActionIdentifier": "is.workflow.actions.speaktext",
      "WFWorkflowActionParameters": {}
    }
  ]
}
```

---

## 方案二：小爱同学（需要额外配置）

小爱同学不直接支持调用外部 API，但可以通过以下方式实现：

### 方法 A：使用「快捷指令」+ iPhone
如果有 iPhone，使用上面的 Siri Shortcuts 方案。

### 方法 B：使用 Home Assistant 或 Node-RED
1. 部署 Home Assistant 或 Node-RED
2. 创建自动化流程接收小爱同学的语音
3. 调用我们的 API

### 方法 C：使用 IFTTT（如果可用）
1. 创建 IFTTT Applet
2. Trigger: 小爱同学语音指令
3. Action: Webhook 调用 `/api/voice-input`

---

## API 参考

### 环境变量

- `DEEPSEEK_API_KEY`: 语音文本解析模型 key
- `AUTH_SECRET`（或 `NEXTAUTH_SECRET`）: 签名当前用户 webhook token
- `VOICE_WEBHOOK_PUBLIC_BASE_URL`（建议）: 快捷指令调用的公开域名（如 `https://bubu.sunmer.xyz`），用于避免预览域名受 Vercel 认证拦截
- `VOICE_WEBHOOK_API_KEY`（可选）: 全局兼容模式鉴权 key（非当前用户自动绑定模式）
- `VOICE_WEBHOOK_DEFAULT_BABY_ID`（可选）: 全局兼容模式下默认宝宝
- `VOICE_WEBHOOK_AUDIT_USER_ID`（可选）: 全局兼容模式下审计日志用户
- `NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL`（可选）: `/settings` 一键安装快捷指令链接（推荐 iCloud 分享链接）

### 先获取当前用户 token（推荐）

```bash
GET /api/webhooks/voice-input/token
Cookie: <登录态 cookie>
```

### 请求

```bash
POST /api/webhooks/voice-input
Authorization: Bearer <SIGNED_WEBHOOK_TOKEN>
Content-Type: application/json

{
  "text": "宝宝刚才喝了60毫升奶",
  "localTime": "2026-02-20 21:30",
  "babyId": "optional-target-baby-id"
}
```

### 成功响应 (201)

```json
{
  "success": true,
  "activity": {
    "id": "...",
    "type": "BOTTLE",
    "recordTime": "2026-01-20T10:30:00.000Z",
    "milkAmount": 60,
    ...
  },
  "parsed": {
    "confidence": 0.95,
    "originalText": "宝宝刚才喝了60毫升奶"
  },
  "message": "已记录: 瓶喂，60 毫升"
}
```

### 错误响应 (400)

```json
{
  "error": "无法识别活动类型",
  "code": "PARSE_FAILED",
  "originalText": "..."
}
```

---

## 支持的活动类型

| 关键词 | 活动类型 | 示例 |
|--------|----------|------|
| 喝奶、瓶喂、奶瓶 | 瓶喂 | "喝了80毫升奶" |
| 亲喂、母乳 | 亲喂 | "亲喂了15分钟" |
| 睡觉、睡眠、睡醒 | 睡眠 | "睡了两个小时" |
| 换尿布、大便、小便 | 换尿布 | "换尿布，有便便" |
| 洗澡、沐浴 | 洗澡 | "洗了澡" |
| 排气操 | 排气操 | "做了排气操" |
| 被动操 | 被动操 | "做了被动操" |
| 抬头、趴着 | 抬头 | "练习抬头10分钟" |
| 翻身 | 翻身 | "翻身3次" |
| 拉坐 | 拉坐 | "拉坐5次" |
| 户外、晒太阳 | 户外 | "出去晒太阳了" |
| 早教、讲故事 | 早教 | "讲了故事" |

## 支持的时间表达

- "刚才"、"刚刚" → 5分钟前
- "X分钟前" → X分钟前
- "X小时前" → X小时前
- 不说时间 → 使用当前时间

## 便便颜色

黄色、绿色、棕色、黑色、白色、红色

## 小便量

少、中/正常、多

---

## 常见问题

### Q: 语音识别不准怎么办？
A: 尽量在安静环境说话，说清楚关键词如"喝奶"、"换尿布"等。

### Q: 可以修改已记录的活动吗？
A: 可以在 App 中修改或删除。

### Q: 支持英文吗？
A: 目前优化为中文，英文可能识别不准。

---

## 技术实现

语音解析使用 Deepseek AI 模型，成本极低（每月约 ¥0.01）。

API 端点:
- `/api/webhooks/voice-input/token`（登录态，生成当前用户 token）
- `/api/webhooks/voice-input`（Bearer token / session / API Key 兼容）
- `/api/voice-input`（登录态）

设置入口:
- `/settings` 页面可一键打开/安装快捷指令（取决于 `NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL` 配置）

源代码:
- `src/app/api/webhooks/voice-input/route.ts`
- `src/app/api/voice-input/route.ts`
