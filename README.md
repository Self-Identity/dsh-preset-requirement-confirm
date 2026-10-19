# dsh-preset-requirement-confirm

[中文](README.md) | [English](README.en.md)

[![npm](https://img.shields.io/npm/v/dsh-preset-requirement-confirm.svg)](https://www.npmjs.com/package/dsh-preset-requirement-confirm)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

一个「先确认、后执行」的 DSH Agent 预设：模型先把需求拆成子需求，用一次问卷逐题确认（选项、多选、手动填写、每题带通俗解释），你提交之后才开始执行。

这个包是一个组合包，包含两半：

- **Agent 预设（host）**：插入一行 `@deepseek-ai/dsh-agent-preset`，预设选择器里出现 **需求确认**。它同时通过 `./tool` 注册 `ask_user_question` 工具，schema 多一个每题可选的 `detail`。
- **浏览器样式（client）**：把每题的说明文本左右内缩 24px，与题目标题对齐，并使用选项释义的灰色。

> 目标客户端：DSH 桌面端 **0.2.1-rc.1 / 0.2.1-rc.2**。

**用法**：用这个模式新建会话 → 描述任务 → 回答模型发来的问卷并提交。模型只在提交后执行；需要授权的操作会在审批面板显示模型写的 `justification`。

## 安装

1. 客户端侧边栏 → **插件** → **添加插件**。
2. 填 `dsh-preset-requirement-confirm@1.3.0`（或选择本地源码目录）。
3. **安装** → **立即启用**；若提示「改动在下次启动生效」，重启客户端。
4. 新建会话，在预设选择器里选 **需求确认**。

## 使用

1. 描述一个包含多个方面的任务。
2. 模型调用 `ask_user_question`：每题显示一段说明（`detail`）、若干选项（含 **以上皆可**）以及手动填写入口。
3. 你提交后模型才开始执行。
4. 需要你授权的操作，审批面板会显示模型写的 `justification`。

## 与出厂 `standard` 预设的差异

对齐 0.2.1-rc.1 / rc.2 的 `standard` 组合，只做两处改动：

- persona 的 `prefix` 增加四步工作流（拆解 → 问卷 → 等待确认 → 授权说明）；
- 禁用出厂的 `@deepseek-ai/dsh-tool-ask-user` 行，由本包的 `./tool` 注册**同名**工具，schema 多一个可选的 `detail` 字段。

其余行与 `standard` 完全一致（persona、agent-instructions、time-context、bash/pwsh、fs、jobs、schedule、skill、goal、计划模式、压缩、委派与 workflow-ptc、todo、web、present、plugin-manager、plugin-market）。

同名注册是刻意的：问卷卡片与工具行靠 `ask_user_question` 这个名字关联，改名会破坏「关闭卡片后从工具行重新打开」等集成。

## 为什么需要浏览器半区

出厂问卷卡片（`dsh-client-ui-user-questions`）把每题的 `detail` 渲染成卡片滚动区里第一个不带 `role` 的子元素，但样式只给它 `margin: 0 2px 8px`，没有左右内边距，于是说明文本贴着卡片边缘，而标题内缩了 24px。

浏览器半区注入一条规则：

```css
[data-question-scroll] > div:first-child:not([role]) {
  margin-inline: 0;
  padding-inline: 24px;
  color: var(--dsw-alias-label-tertiary);
}
```

选择器锚定结构而不是 class 名：CSS Module 的 class 名每次构建都会变，而 `data-question-scroll`、不带 `role` 的说明块、带 `role` 的选项块是稳定的。没有 `detail` 的题目，第一个子元素就是选项块（带 `role`），因此规则不会误伤。样式节点挂在插件 fiber 上，禁用或重载时自动移除。

## 已知限制

- **选择器依赖卡片结构。** 如果未来客户端去掉 `data-question-scroll` 或调整子元素顺序，样式会静默失效，但不会破坏布局。
- **只影响通用问卷卡片。** 计划评审卡、已作答回放卡不使用 `data-question-scroll`。
- **预设是软约束。** 模型仍可能跳过问卷；需要硬性拦截时请配合沙箱与审批策略。
- **审批说明不是独立折叠区。** 插件通过 persona 要求模型写清楚 `justification`，不修改客户端。

## 兼容性

目标客户端 **0.2.1-rc.2**。全部 JavaScript 都不 import `@deepseek-ai/*`：host 半区只用 `ctx.tools.register()` 与 `ctx.userQuestions.ask()`，client 半区只用浏览器模块加载器与 DOM。

## 目录结构

```
dsh-preset-requirement-confirm/
├── package.json         # dsh.bundle.patch（host 补丁）+ dsh.client（浏览器半区）
├── cordis.patch.yml     # 预设声明 + bundle 级行
├── lib/index.js         # bundle 行 host 半区：惰性
├── lib/tool.js          # 预设行：注册带 detail 的 ask_user_question
├── lib/client.js        # 浏览器半区：说明文本对齐与配色
└── README.md
```

## 卸载

在 **插件** 里禁用或移除该组合包，然后重启客户端。

## 开发

```powershell
node --check lib/index.js
node --check lib/tool.js
node --check lib/client.js
node tools/validate.mjs
```

## 许可

MIT。与 DeepSeek 官方无隶属关系。
