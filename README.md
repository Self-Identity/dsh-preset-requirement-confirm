# dsh-preset-requirement-confirm

给 DSH 官方客户端增加一个 **需求确认** Agent 预设：收到需求后先把需求拆解成多个子需求，用一次 `ask_user_question` 问卷让用户逐题确认（多选项、可多选、可手动填写、每题带通俗解释），用户提交之后才开始执行。

这是一个 **bundle 插件包**：安装进 profile 后，它插入一行 `@deepseek-ai/dsh-agent-preset` 声明，新会话的预设选择器里就会出现「需求确认」。

> **适配版本：DSH 官方桌面端 0.2.1-rc.1 / 0.2.1-rc.2**（两者随包的契约文件逐字节一致）。

## 安装（官方客户端）

1. 打开 DSH 官方客户端 → 侧边栏 **插件（Plugins）**；
2. **添加插件（Add plugin）** → 填**本目录的绝对路径**：
   `F:\DSH-Official-Plugins\dsh-preset-requirement-confirm`
3. 安装完成后确认卡片开关为**已启用**、状态为**已挂载**；提示「下次启动生效」时重启客户端；
4. 新建会话，在预设选择器里选**需求确认**。

> ⚠️ **不要把本目录（或指向它的 junction）放进 `F:\DSH-Official` 里面。** 客户端更新会递归清理自己的安装目录；如果那里存在指向本目录的 junction，清理可能**穿透 junction 清空本目录的内容**（详见下节）。

## 为什么源码会"丢失"（重要）

**现象**：把插件源码迁到 `F:\DSH-Official-Plugins` 后，更新客户端，四个插件目录还在，但**内容是空的**（目录最后修改时间正好是安装更新的时刻）。

**原因**：迁移时仍在 `F:\DSH-Official\plugins` 里保留了指向源码目录的 **junction**（目录联接）。更新器清理安装目录时做的是递归删除；Windows 上某些递归删除实现（典型是 PowerShell 5.1 的 `Remove-Item -Recurse`）**会跟随 junction 进入目标目录**，把 `F:\DSH-Official-Plugins\<插件>` 的内容删掉——junction 只是"不见了"，源码目录被清空。

**正确做法**：`F:\DSH-Official` 里**什么都不放**。插件源码只放 `F:\DSH-Official-Plugins`，安装时让客户端把 profile 的 `link:` 依赖**直接指向源码目录**（`link:F:/DSH-Official-Plugins/<包名>`）——这样更新器只会动 `F:\DSH-Official`，碰不到源码。另外源码目录务必另存一份版本库/压缩包：任何"链接式安装"在递归删除面前都可能连带受损。

## 使用

1. 你发一个包含多个方面的任务；
2. 模型先调用 `ask_user_question` 弹出问卷：每题显示一段通俗解释（`detail`）、若干选项（含「以上皆可」）、以及手动填写入口；
3. 你提交问卷之后模型才开始执行；
4. 执行中出现需要授权的操作时，审批面板显示模型写的 `justification`。

## 与出厂「标准模式」的差异

对齐 0.2.1-rc.1/rc.2 的 standard 预设行，只做两处改动：

- persona 的 `prefix` 增加「需求确认工作流」四步（拆解 → 问卷 → 等待确认 → 授权说明）；
- 禁用出厂的 `@deepseek-ai/dsh-tool-ask-user` 行，改由本包注册**同名** `ask_user_question` 工具，schema 多一个每题可选的 `detail`。

其余行与出厂 standard 完全一致（persona、agent-instructions、time-context、bash/pwsh、fs、jobs、schedule、skill、goal、计划模式、压缩、委派与 workflow-ptc、todo、web、present、plugin-manager、plugin-market）。

同名注册是刻意的：官方问卷卡片与工具行按 `ask_user_question` 这个工具名关联，换名会失去「关闭卡片后从工具行重新打开」等集成能力。

## 已验证 / 未验证

已在本机用官方运行时验证（0.2.1-rc.2）：

- `node --check lib/index.js` 通过；
- 补丁层结构合法（顶层数组、行 id 唯一、kebab-case）；
- 补丁引用的每个 `@deepseek-ai/*` 包都存在于 0.2.1-rc.2 的 `app.asar`；
- `lib/index.js` 契约冒烟测试：注册名 `ask_user_question`、`output.schema` + `output.render` 满足官方 `register()` 校验、schema 含 `detail`、`execute` 把 `detail`/`header`/`options`/`multiSelect` 透传给 `ctx.userQuestions.ask()`、拒绝重复问题 id、原样返回答案。

**未验证：真实挂载。** 验证预设真正挂载需要启动 Web 应用（会开端口），本机不重复起服务；以客户端启用后的「已挂载」状态为准。

## 已知限制

- **「请详细说明」在官方客户端是内联展示**：官方问卷卡片把 `detail` 直接渲染在问题下方，没有折叠按钮；折叠交互属于上游 UI 能力。
- **审批解释不是独立折叠区**：官方审批面板展示请求方文案与关联工具详情；本插件通过 persona 要求模型写清楚 `justification`，不修改客户端代码。
- **预设是软约束**：模型仍可能跳过问卷直接执行；需要硬性拦截请配合沙箱与审批策略。
- **工具行的解析兜底**：工具行用裸包名（`dsh-preset-requirement-confirm`）。若某次部署无法解析，可改成显式文件 URL：
  ```yaml
  - id: tool-requirement-questionnaire
    name: 'file:///F:/DSH-Official-Plugins/dsh-preset-requirement-confirm/lib/index.js'
  ```
  或删掉该行并去掉 `tool-ask-user` 的 `disabled: true`（回到出厂工具，代价是没有 `detail`）。

## 卸载

在插件页停用或移除该 bundle。

## 目录结构

```
dsh-preset-requirement-confirm/
├── package.json         # 声明 dsh.bundle.patch，指向下面这个补丁层
├── cordis.patch.yml     # 插入 preset 行（含全部 standard 行 + 本包工具行）
├── lib/index.js         # 零依赖插件：注册带 detail 的 ask_user_question
└── README.md
```

`lib/index.js` **不 import 任何 `@deepseek-ai/*` 包**：本机 `$DSH_HOME/profiles/node_modules` 可能指向另一份检出，裸导入会加载第二份运行时模块。因此它只用 `ctx.tools.register()`（原始定义形状）与 `ctx.userQuestions.ask()`。
