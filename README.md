# 宝宝日记 Monorepo

一个使用 Turborepo 管理的 monorepo，包含宝宝护理记录应用及共享 UI 组件库。

## 📦 项目结构

```
├── apps/
│   └── bubu-log/     # 宝宝日记 Next.js 应用
├── packages/
│   ├── ui/           # 共享 UI 组件库 (基于 shadcn/ui)
│   └── typescript-config/  # 共享 TypeScript 配置
```

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 运行所有应用的开发服务器
pnpm dev

# 只运行 web 应用
pnpm dev:web

# 构建所有项目
pnpm build

# 代码检查
pnpm lint
```

## 🔐 gh 账号自动选择（按目录）

仓库提交了 `.envrc`（不包含 token 或账号硬编码）。  
具体账号通过本地忽略文件 `.envrc.local` 提供，这样每个人都能自行切换。

### 1) 安装并启用 direnv

```bash
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
exec zsh
```

### 2) 在仓库目录授权一次

```bash
cd /Users/sun/Documents/personal/sunmer-home
cp .envrc.local.example .envrc.local
direnv allow
```

### 3) 验证

```bash
gh auth status
gh api user -q .login
```

如果需要切换账号，修改 `.envrc.local` 里的 `GH_ACCOUNT` 后重新进入目录即可。

## 📱 宝宝日记 (apps/bubu-log)

一个简单易用的婴儿护理记录应用，专为月嫂阿姨和家长设计。

### 功能

- 🌙 **睡眠** - 入睡/睡醒记录
- 🍼 **喂奶** - 亲喂/瓶喂，时长和奶量
- 🧒 **换尿布** - 大小便记录
- 🎯 **活动** - 被动操、排气操、洗澡、户外、早教
- 👶 **多宝宝 URL 上下文** - 通过 `/b/[babyId]` 精准定位并分享宝宝视图
- 🧭 **抽屉导航** - 首页右上角抽屉统一导航到统计/审计/宝宝管理/设置

> 多宝宝路由和接口说明见 `apps/bubu-log/docs/multi-baby-url-guide.md`

> 详细功能规格见 `.cursor/rules/features/`

### 技术栈

- Next.js 16 + Tailwind CSS 4
- PostgreSQL + Payload CMS（@payloadcms/db-postgres）
- Vercel (Blob Storage + 部署)
- Turborepo (monorepo 管理)

### 配置

```bash
# 配置环境变量
cp apps/bubu-log/.env.example apps/bubu-log/.env.local
# 编辑 .env.local 添加数据库连接

# 初始化数据库
cd apps/bubu-log && pnpm db:migrate
```

### E2E 测试

E2E 测试会自动启动本地 Docker Postgres，并写入专用测试数据：

```bash
cd apps/bubu-log && pnpm test:e2e
```

调试模式：

```bash
cd apps/bubu-log && pnpm test:e2e:ui
cd apps/bubu-log && pnpm test:e2e:headed
cd apps/bubu-log && pnpm test:e2e:debug
```

## 🎨 UI 组件库 (packages/ui)

基于 shadcn/ui 的共享 React 组件库，可在多个应用间复用。

### 使用方式

```tsx
import { Button, cn } from '@bubu-log/ui'
import { Drawer, DrawerContent } from '@bubu-log/ui'
```

## 部署到 Vercel

### 定时任务（每日统计自动计算）

- 已配置 Vercel Cron：每天 `03:00`（Asia/Shanghai）执行一次
- 路径：`/api/cron/daily-stats-yesterday`
- 功能：自动计算所有宝宝“前一天”的统计数据
- 必须在 Vercel 环境变量中设置：`CRON_SECRET`

### 数据库迁移

当修改了 Payload collections / 数据模型后，需要在生产环境运行迁移：

```bash
# 方法 1: 使用脚本（推荐）
cd apps/bubu-log && pnpm db:migrate:prod

# 方法 2: 手动操作
# 1. 从 Vercel 拉取环境变量
vercel env pull .env.production

# 2. 设置环境变量并运行迁移
export DATABASE_URL=$(grep "^DATABASE_URL=" .env.production | cut -d '=' -f2-)
export DATABASE_URL_UNPOOLED=$(grep "^DATABASE_URL_UNPOOLED=" .env.production | cut -d '=' -f2-)
export PAYLOAD_DATABASE_URL=$(grep "^PAYLOAD_DATABASE_URL=" .env.production | cut -d '=' -f2-)
[ -z "$PAYLOAD_DATABASE_URL" ] && export PAYLOAD_DATABASE_URL="$DATABASE_URL"
cd apps/bubu-log && pnpm db:migrate

# 3. 清理临时文件
rm .env.production
```

**注意**: 确保已安装并登录 Vercel CLI: `pnpm add -g vercel && vercel login`

## 使用 E2B 做 PR 分支预览（替代 Vercel Preview）

仓库已新增 workflow：`.github/workflows/e2b-preview.yml`

- PR `opened/reopened/synchronize/ready_for_review`：创建（或替换）E2B sandbox，并在 PR 评论里回贴预览链接
- PR `closed`：自动清理该 PR 对应的 E2B sandbox
- 生产发布仍可继续使用 Vercel

### 必需 Secrets

- `BUBU_LOG_E2B_API_KEY`：E2B API key
- `E2B_PREVIEW_ENV_B64`：`apps/bubu-log` 预览环境变量（base64 编码后的 dotenv 文本）

建议将本地 `apps/bubu-log/.env.preview.local` 作为来源，编码后写入 Secret：

```bash
base64 < apps/bubu-log/.env.preview.local | tr -d '\n'
```

`E2B_PREVIEW_ENV_B64` 至少建议包含：

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `PAYLOAD_DATABASE_URL`
- `AUTH_SECRET`
- `PAYLOAD_SECRET`

### 可选 Repository Variables

- `E2B_TEMPLATE`：自定义 sandbox template（默认 `base`）
- `E2B_TIMEOUT_MS`：sandbox 生命周期（毫秒，默认 `3600000`）
- `E2B_APP_PORT`：应用端口（默认 `1030`）
- `E2B_APP_PATH`：应用目录（默认 `apps/bubu-log`）

### 构建更大规格 E2B Template（解决 `signal: killed`）

当预览日志显示安装依赖阶段被 `signal: killed` 时，通常是沙箱资源不足。可构建更大模板并绑定到仓库变量：

```bash
cd /Users/sun/Documents/personal/sunmer-home
export E2B_API_KEY=your_e2b_api_key

# 默认构建: bubu-preview-large, 4 vCPU, 4096 MB
pnpm dlx --package e2b@2.13.0 --package tsx tsx scripts/e2b-template/build.prod.ts

# 绑定到仓库 E2B PR Preview workflow
gh variable set E2B_TEMPLATE --repo Stupidism/sunmer-home --body bubu-preview-large
```

可选：提高规格

```bash
E2B_TEMPLATE_CPU=8 E2B_TEMPLATE_MEMORY_MB=8192 \
pnpm dlx --package e2b@2.13.0 --package tsx tsx scripts/e2b-template/build.prod.ts
```

更多细节见：`scripts/e2b-template/README.md`

## 访问地址

- 🌐 https://bubu.sunmer.xyz
- 🔗 https://bubu-log.vercel.app

## License

MIT
