# Commit 技能

按照项目的 conventional commit 风格创建规范的 git 提交。

## 步骤

1. 运行 `git status` 和 `git diff --staged` 了解将要提交的内容
2. 如果没有暂存的文件，识别相关的已修改文件并暂存（不要使用 `git add -A`）
3. 不要提交包含敏感信息的文件（.env、凭据、API 密钥）
4. 按照 conventional commits 规范编写提交信息：
   - 格式：`<type>(<scope>): <description>`
   - 类型：`feat`、`fix`、`chore`、`refactor`、`test`、`docs`
   - 范围：应用名称（`bubu-log`、`nunu-island` 等），仓库级别的改动可省略
   - 描述：使用祈使语气，小写，不加句号
   - 正文：如果从描述中无法明显看出原因，请解释"为什么"
5. 创建提交（包含 Co-Authored-By 尾注）
6. 运行 `git status` 确认提交成功

## 规则

- 除非明确要求，不要修改已有提交（amend）
- 不要使用 `--no-verify` 跳过钩子
- 如果 pre-commit 钩子失败，修复问题后创建新的提交
- 保持提交原子性：每次提交只包含一个逻辑变更
