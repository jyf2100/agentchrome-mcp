# AgentChrome MCP（ACM）

让任何支持 MCP 的 AI 宿主操控用户自己的 Chrome——带着全部登录态。三个实体组成：发行物（npm 包）、Chrome 扩展、常驻桥。命名决策见 [docs/adr/0001](docs/adr/0001-product-three-entities-naming.md)。

## Language

### 实体

**ACM**:
AgentChrome MCP 的简称，指发行物、扩展、桥三者构成的整个产品。
_Avoid_: huashu-chrome（历史名，仅存于迁移逻辑）

**发行物（package）**:
npm 包 `agentchrome-mcp`，含 CLI、MCP server、桥。仓库与包同名。
_Avoid_: huashu-chrome（npm 上是上游原作者的包）

**扩展（extension）**:
Chrome MV3 扩展，显示名 `agentchrome`，是 ACM 在浏览器里的「手」。
_Avoid_: 插件

**桥（bridge）**:
127.0.0.1:8899 上的常驻路由进程，一头连扩展、一头连各 MCP server。
_Avoid_: server、网关

**宿主（host）**:
通过 MCP 接入 ACM 的 AI 编程工具（Claude Code、Codex、Cursor……）。CLI 参数 `--client` 是它的历史别名。
_Avoid_: client、agent（一词多义）

### 连接与操作

**会话（session）**:
桥上一次宿主连接，持有 sid、身份色和 emoji，是页面侧标识「谁在动」的单位。
_Avoid_: 连接

**工作线（work-line）**:
一条独立的浏览操作线，各自持有受控标签页；并行（含 subagent）时防止互相抢页。
_Avoid_: 会话（工作线是人的组织单位，会话是连接的单位）

**受控标签页（controlled tab）**:
由扩展代宿主操作的浏览器标签页，进入以身份色命名的标签组。

**驾驶舱（cockpit）**:
扩展侧栏面板，实时展示宿主正在操作哪页、准备做什么、刚做了什么。

**高保真模式（high-fidelity）**:
经 CDP 派发真实输入事件的模式，过验证码、唤起真实键盘行为时必须。

### 站点知识

**经验（learnings）**:
按域名沉淀的站点规律，分出厂经验（随包分发）与本机经验（`~/.huashu-chrome/learnings/`，升级不覆盖）。
_Avoid_: 笔记、文档

**剧本（act draft）**:
一段可整体复放的操作序列草稿；确认可复用后收编为正式经验。
_Avoid_: 脚本（与页面用户脚本混淆）

**身份色（identity color）**:
会话专属颜色，用于标签组、页面边缘描边与虚拟光标，区分同时干活的多个宿主。

**双脑（dual brain）**:
可选加速模式：主脑定计划，快脑（便宜模型）跑操作循环；单脑下能力完整。
