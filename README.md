# dsh-preset-requirement-confirm

给 DSH 官方客户端增加一个 **需求确认** Agent 预设：收到需求后先把需求拆解成多个子需求，用一次 `ask_user_question` 问卷让用户逐题确认（多选项、可多选、可手动填写、每题带通俗解释），用户提交之后才开始执行。

这是一个 **bundle 插件包**，含两部分：

- **Agent 预设**（host）：插入一行 `@deepseek-ai/dsh-agent-preset` 声明，新会话的预设选择器里出现「需求确认」；自带一个注册同名 `ask_user_question` 的工具（schema 多一个每题可选的 `detail`）。
- **浏览器样式**（client）：把问卷标题下方的解释文本左右各内缩 24px（与标题左对齐），并把颜色改为与选项释义同款的灰（`--dsw-alias-label-tertiary`）。

> **适配版本：DSH 官方桌面端 0.2.1-rc.1 / 0.2.1-rc.2**（两者随包的契约文件逐字节一致）。

**English**: *Requirement Confirmation* — the standard coding agent plus a confirm-before-execute questionnaire. Usage: create a session in this mode → describe the task → answer the questionnaire (choices, multi-select, free text, a plain-language explanation per question) → submit → the agent executes. The browser half aligns each explanation with its question title and paints it in the option-description gray.

## 安装（官方客户端）

1. 打开 DSH 官方客户端 → 侧边栏 **插件（Plugins）**；
2. **添加插件（Add plugin）** → 填**源码目录的绝对路径**：
   `F:\plugins-for-dsh\dsh-preset-requirement-confirm`
3. 安装完成后确认卡片开关为**已启用**、状态为**已挂载**；提示「下次启动生效」时重启客户端；
4. 新建会话，在预设选择器里选**需求确认**。

> ⚠️ **不要把本目录（或指向它的 junction）放进 `F:\DSH-Official`。** 客户端更新会递归清理自己的安装目录；如果那里存在指向本目录的 junction，清理会**跟随 junction 清空本目录内容**（本机已发生两次）。

## 问卷样式（client 半区，v1.2.0 起）

官方问卷卡片（`dsh-client-ui-user-questions`）把每题的 `detail` 渲染为卡片滚动区里**第一个不带 `role` 的子元素**，而官方样式只给它 `margin: 0 2px 8px`、没有左右内边距：

- 标题位于 header，左内边距 **24px**，因此解释文本原先贴着卡片左边（2px），与标题不对齐；
- 选项释义使用 `--dsw-alias-label-tertiary` 灰。

本插件的浏览器半区（`lib/client.js`）注入一条样式（`<style data-plugin="dsh-preset-requirement-confirm">`）：

```css
[data-question-scroll] > div:first-child:not([role]) {
  margin-inline: 0;
  padding-inline: 24px;
  color: var(--dsw-alias-label-tertiary);
}
```

- 左内边距 24px 让解释文本**与标题对齐**，右侧同样留 24px 空白；
- 颜色改为选项释义同款灰；
- 选择器用**结构锚点**而不是 class 名——卡片 class 是每次构建变化的 CSS Module 哈希，而 `data-question-scroll`、无 `role` 的解释块、带 `role` 的选项块在各版本稳定；题目没有 `detail` 时第一个子元素就是选项块（带 `role`），不会误伤。

样式注入挂在插件 fiber 上：禁用插件或热重载时自动移除，不会残留。

## 使用

1. 你发一个包含多个方面的任务；
2. 模型先调用 `ask_user_question` 弹出问卷：每题显示一段通俗解释（`detail`）、若干选项（含「以上皆可」）、以及手动填写入口；
3. 你提交问卷之后模型才开始执行；
4. 执行中出现需要授权的操作时，审批面板显示模型写的 `justification`。

## 与出厂「标准模式」的差异

对齐 0.2.1-rc.1/rc.2 的 standard 预设行，只做两处改动：

- persona 的 `prefix` 增加「需求确认工作流」四步（拆解 → 问卷 → 等待确认 → 授权说明）；
- 禁用出厂的 `@deepseek-ai/dsh-tool-ask-user` 行，改由本包 `./tool` 注册**同名** `ask_user_question` 工具，schema 多一个每题可选的 `detail`。

其余行与出厂 standard 完全一致（persona、agent-instructions、time-context、bash/pwsh、fs、jobs、schedule、skill、goal、计划模式、压缩、委派与 workflow-ptc、todo、web、present、plugin-manager、plugin-market）。

同名注册是刻意的：官方问卷卡片与工具行按 `ask_user_question` 这个工具名关联，换名会失去「关闭卡片后从工具行重新打开」等集成能力。

## 已验证 / 未验证

已在本机验证（0.2.1-rc.2）：

- `node --check` 通过（`lib/index.js`、`lib/tool.js`、`lib/client.js`）；
- 清单/补丁结构：`dsh.bundle.patch`、`dsh.client.platform = web`、导出 `.` / `./tool` / `./client` 齐全；补丁两层 insert，行 id 唯一；
- Host 冒烟：bundle 行无副作用；`./tool` 注册 `ask_user_question`（含 `detail`、重复 id 拒绝）；
- Client 冒烟：注入的 `<style>` 内容/选择器正确，`ctx.effect` 清理时移除节点，重复 apply 不重复插入；
- 样式锚点对照官方 0.2.1-rc.2 bundle：`data-question-scroll`、解释块为第一个无 `role` 子元素、选项释义用 `--dsw-alias-label-tertiary`、标题左内边距 24px —— 均存在；
- `check-bundle.mjs`：problem=0。

**未验证：真实浏览器渲染。** 视觉结果需要重启客户端后打开一次问卷确认（见下）。若样式未生效，先确认插件页显示「已挂载」，并强制刷新页面（`Ctrl+F5`）。

## 元数据与双语（v1.3.0）

插件页的标题与描述来自 `locale/<language>.json` 的 `meta.title` / `meta.description`，按当前界面语言选择，英文回退到 `package.json` 的 `name` / `description`：

- `locale/zh.json` —— `需求确认` + 中文介绍（含使用流程）；
- `locale/en.json` —— `Requirement Confirmation` + English description (with the usage flow)；
- `package.json` 的 `description` 是英文回退；`icon.svg` 是插件页图标。

预设选择器里的名称/描述由 `cordis.patch.yml` 提供。官方只翻译出厂预设；用户自建预设的元数据不会被翻译，所以预设名与描述写成「中文（English）」形式。

## 已知限制

- **选择器依赖卡片结构**：若未来客户端改掉 `data-question-scroll` 或调整子元素顺序，样式会静默失效（不会报错，也不会破坏布局）；届时按新版 bundle 重新校准选择器即可。
- **只影响通用问卷卡片**：计划评审卡、已作答回放卡不使用 `data-question-scroll`，不受影响。
- **预设是软约束**：模型仍可能跳过问卷直接执行；需要硬性拦截请配合沙箱与审批策略。
- **审批解释不是独立折叠区**：官方审批面板展示请求方文案与关联工具详情；本插件通过 persona 要求模型写清楚 `justification`，不修改客户端代码。

## 卸载

在插件页停用或移除该 bundle。

## 目录结构

```
dsh-preset-requirement-confirm/
├── package.json         # dsh.bundle.patch（host 补丁）+ dsh.client（浏览器半区）
├── cordis.patch.yml     # 预设声明 + bundle 级行
├── lib/index.js         # bundle 行的 host 半区：无副作用
├── lib/tool.js          # 预设行：注册带 detail 的 ask_user_question
├── lib/client.js        # 浏览器半区：问卷解释文本的对齐与配色
└── README.md
```

所有 JS 都**不 import 任何 `@deepseek-ai/*` 包**：本机 `$DSH_HOME/profiles/node_modules` 可能指向另一份检出，裸导入会加载第二份运行时模块。host 只用 `ctx.tools.register()`（原始定义形状）与 `ctx.userQuestions.ask()`；client 只用 `window.__ModuleLoader__` 与 DOM。
