# 产品是三个实体：发行物 agentchrome-mcp、扩展 agentchrome、简称 ACM

产品从 huashu-chrome 更名时发现「产品」一词承载了三个可独立演化的实体，混用一个名字导致改名时四处漏改（npm 面、扩展面、生成物各自为政）。决定：**发行物**（npm 包 + CLI + MCP server + 桥）叫 `agentchrome-mcp`；**Chrome 扩展**（显示名、标签组名、头像）叫 `agentchrome`；两者及桥的统称与口语简称是 **ACM**（AgentChrome MCP）。GitHub 仓库随发行物改名为 `agentchrome-mcp`。

## Considered Options

- 单一名字贯穿所有实体（如全部叫 agentchrome-mcp）——被否：扩展名在 16px 图标、标签组、应用商店场景需要更短的名字。
- 用 `agent-chrome`——被否：npm 上已被他人占用，且占用者的包描述与本产品几乎一致（疑似 fork 抢注），法律与混淆风险。

## Consequences

- `huashu-chrome` 从此是历史名，仅出现在迁移逻辑（install 检测旧配置键并迁移）和本文档中。
- 用户数据目录**有意保留** `~/.huashu-chrome/`：改名会把存量用户的经验库、审计日志变成孤儿，收益（命名整洁）远小于代价（数据迁移），不做。
- 旧 npm 包 `huashu-chrome` 发布归属上游原作者，本发行物永不复用该名。
