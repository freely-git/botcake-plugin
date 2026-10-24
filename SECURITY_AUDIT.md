# Botcake Plugin 安全审核报告

- 审核日期：2026-10-24
- 审核基线：`main` / `7953521`
- 项目类型：Chrome Manifest V3 扩展
- 技术栈：JavaScript、Vue 3、Ant Design Vue、Vite 8、npm
- 审核范围：15 个 Git 跟踪文件，约 1,341 行非锁文件内容，全部 6 个 Git 提交历史，以及 `package-lock.json` 中 89 个包记录（包含平台可选包；当前环境实际审计 66 个安装包）

## 结论

审核前 `npm audit` 报告 6 条 High 级别的受影响依赖路径，另有扩展将认证令牌暴露到 DOM、允许网页脚本伪造特权存储事件、Manifest 权限过宽以及 CI 供应链不够固定等问题。能在不改变 Botcake API 协议的前提下安全修复的内容已全部修复。

修复后：

- `npm audit`：0 Critical / 0 High / 0 Medium / 0 Low。
- OSV Query API：对锁文件全部 89 个精确包版本查询，返回 0 个已知漏洞（仅代表 2026-10-24 当时数据）。
- 干净安装、生产构建、Manifest JSON 解析和 ZIP 产物目录验证均通过。
- 未发现已提交的 API Key、Token、密码、私钥、证书、数据库连接串或 Webhook。

尚有两项令牌边界加固需要开发者确认 Botcake 私有 API 兼容性，或同意改变扩展运行架构，本次没有擅自改动。

## 直接依赖

| 依赖 | 声明范围 | 修复前实际版本 | 修复后实际版本 | 用途 / 结果 |
| --- | --- | --- | --- | --- |
| `ant-design-vue` | `^4.2.6` | 4.2.6 | 4.2.6 | UI 组件；本地审计与 OSV 未命中已知漏洞 |
| `dayjs` | `^1.11.20` | 1.11.20 | 1.11.23 | 日期和时区；安全的小版本升级 |
| `vue` | `^3.5.32` | 3.5.33 | 3.5.44 | 客户端 UI；间接 SSR 高危公告已修复 |
| `@vitejs/plugin-vue` | `^6.0.6` | 6.0.6 | 6.0.10 | 构建插件；安全的小版本升级 |
| `vite` | `^8.0.10` | 8.0.10 | 8.3.5 | 构建 / 开发服务器；多个已知问题已修复 |

## 关键间接依赖

| 依赖 | 修复前 | 修复后 | 说明 |
| --- | ---: | ---: | --- |
| `@vue/server-renderer` | 3.5.33 | 3.5.44 | GHSA-g2v6-rqmx-r4w6 已修复；本项目不使用 SSR，受影响路径未实际调用 |
| `@vue/compiler-sfc` | 3.5.33 | 3.5.44 | Vue SFC 构建 |
| `postcss` | 8.5.14 | 8.5.31 | 源映射路径穿越 / 文件泄露公告已修复 |
| `nanoid` | 3.3.12 | 3.3.20 | 非法 size 导致无限循环的公告已修复 |
| `source-map-js` | 1.2.1 | 1.2.2 | indexed source map 事件循环 DoS 已修复 |
| `rolldown` | 1.0.0-rc.17 | 1.2.15 | Vite 构建器 |
| `lightningcss` | 1.32.0 | 1.33.0 | CSS 构建 |
| `lodash` / `lodash-es` | 4.18.1 | 4.18.1 | Ant Design Vue 间接依赖 |
| `@babel/runtime` | 7.29.2 | 7.29.10 | Ant Design Vue 间接依赖 |

### 维护状态

- 未发现 npm 标记为 deprecated 的包，也未发现明显的仿冒 / 拼写欺诈包名。
- `resize-observer-polyfill@1.5.1`（最后版本发布于 2018）、`dom-scroll-into-view@2.0.1`（2019）、`warning@4.0.3`（2019）是 Ant Design Vue 引入的长期未发版间接依赖。当前未命中已知漏洞，且不宜通过 override 强行跨主版本；建议随 Ant Design Vue 后续升级替换。

## 问题汇总

| 编号 | 类别 | 严重级别 | 位置 | 状态 |
| --- | --- | --- | --- | --- |
| SEC-01 | 依赖 | High | `package-lock.json` | 已修复 |
| SEC-02 | 代码 / 令牌泄露 | High | `src/content/index.js:7-40`（修复前） | 已修复 |
| SEC-03 | 代码 / 令牌传输 | Medium | `src/popup/App.vue:425-429, 786-790` | 待开发者决定 |
| SEC-04 | 扩展架构 / 令牌存储 | Medium | `src/content/index.js:15-24`; `src/popup/App.vue:786, 811-823` | 待开发者决定 |
| SEC-05 | 扩展权限 | Medium | `public/manifest.json:5, 19-24`（修复前） | 已修复 |
| SEC-06 | CI/CD | Medium | `.github/workflows/release.yml:17-48` | 已修复 |
| SEC-07 | 代码 / 可用性 | Low | `src/popup/App.vue:361-369, 828-833` | 已修复 |
| SEC-08 | 密钥防护 | Low | `.gitignore` | 已修复 |
| SEC-09 | 代码 / 导航判定 | Low | `src/content/index.js:2-4` | 已修复 |

## 详细问题与修复

### SEC-01：锁文件中存在已知高危依赖

- 风险：修复前 `npm audit` 识别出 6 个 High 级别受影响包条目。
- 受影响功能：
  - Vite 问题主要位于开发服务器、Windows `launch-editor` 和文件访问边界；生产扩展包中不运行 Vite，但开发环境仍可受影响。
  - Vue 公告只影响 SSR 属性渲染；本项目只使用 `createApp` 客户端渲染，因此未发现实际可达路径。
  - PostCSS、Nano ID 和 source-map-js 是构建期间接依赖；未发现将不可信 CSS、source map 或 size 参数传入这些受影响 API 的项目代码。
- 修复：在现有 semver 范围内更新锁文件，未做大版本升级。
- 参考：
  - https://github.com/advisories/GHSA-g2v6-rqmx-r4w6
  - https://github.com/advisories/GHSA-fx2h-pf6j-xcff
  - https://github.com/advisories/GHSA-r28c-9q8g-f849
  - https://github.com/advisories/GHSA-28wg-ghj8-5hjv
  - https://github.com/advisories/GHSA-68fv-2mgg-jv7q

### SEC-02：令牌暴露到 DOM，网页可伪造插件特权事件

- 利用条件：攻击者能够在 `botcake.io` 页面上执行脚本，例如页面 XSS、受损的第三方脚本或其他能访问该 DOM 的代码。
- 风险：修复前代码把 Cookie JWT 和扩展存储中的 token 写入 `<script data-*>`；同时任意页面脚本都能派发 `SAVE_BOTCAKE_DATA` / `REMOVE_BOTCAKE_DATA` 事件，修改扩展存储。
- 修复：删除 DOM 令牌传递、删除可伪造的 `window` 事件桥，并删除因此不再需要的 `storage` 权限。这些代码在 Vue 应用中没有对应的发送方 / 读取方，删除不改变现有业务流程。
- 处置建议：如果旧版扩展已经分发，且无法排除 Botcake 页面曾运行不可信脚本，建议对相关登录会话 / token 做失效或轮换，并尽快强制用户升级到修复版。

### SEC-03：访问令牌放在 URL 查询参数中

- 利用条件：服务器、反向代理、调试工具、监控系统或浏览器网络日志保存完整请求 URL。
- 风险：`access_token` 可进入 URL 日志或遥测数据，导致凭据泄露。
- 已做的安全修复：改用 `URL` / `URLSearchParams` 构造 URL，避免令牌或 page ID 造成查询注入或路径注入。
- 未做的协议修改：将令牌改到 `access-token` 或 `user-access-token` 请求头。Botcake 公开 API 文档展示了请求头鉴权，但当前代码使用的是未在该文档中确认的私有 `/api/v1/pages` 端点，因此直接更换可能使功能失效。**待确认**。

### SEC-04：UI 和手动令牌运行在 Botcake 页面主世界

- 利用条件：`botcake.io` 同源脚本、已注册的同源 Service Worker 或该站点中存在 XSS。
- 风险：手动输入的 token 保存在 `botcake.io` 的 `localStorage`；扩展 UI 也以页面主世界脚本运行，而不是隔离的扩展页面。
- 建议：将看板改为 `chrome-extension://.../index.html` 扩展页面，使用 `chrome.storage.session` 或 `chrome.storage.local`；如果仍要自动读取 Botcake Cookie，需新增 `cookies` 和精确的 `https://botcake.io/*` host permission。这会改变用户看到的权限提示和运行架构，因此本次未擅自实施。

### SEC-05：Manifest 权限和 Web 可访问资源过宽

- 风险：`tabs`、`webNavigation`、`storage` 和 `host_permissions` 均不是当前逻辑所需；`assets/*` 会把所有构建资源暴露给 Botcake 网页。
- 修复：删除未使用权限和无效的 `webNavigation` 监听器；Web 可访问资源收紧到 `popup.js` 和 `popup.css`。Chrome 官方文档明确说明 `chrome.tabs.create()` 不需要 `tabs` 权限。

### SEC-06：发布工作流供应链和 Shell 注入风险

- 风险：GitHub Actions 仅固定可移动的 major tag；`${{ github.ref_name }}` 被直接插入 shell 命令；checkout 默认在工作目录保留具有写权的 Git 凭据；`npm ci` 允许依赖安装脚本执行。
- 利用条件：Action tag 被移动 / 上游账户受损，包供应链受损，或攻击者可创建恶意 `v*` tag。
- 修复：4 个 Action 全部固定到来自原仓库的完整 commit SHA；`ref_name` 经环境变量传递并引用；关闭 checkout 凭据持久化；CI 使用 `npm ci --ignore-scripts`，并在发布前执行 `npm audit --audit-level=high`。这些设置已在本地验证仍能构建。

### SEC-07：本地存储可导致启动 DoS，退出会清空整个站点存储

- 风险：损坏的 `MULTI_PAGE_IDS` JSON 会使应用在初始化前抛错；`localStorage.clear()` 会删除 Botcake 同源的所有其他键。
- 修复：安全解析并检查数组类型，无效值自动恢复；退出时只删除 `BOTCAKE_TOKEN` 并清理内存中的 token。

### SEC-08：本地密钥文件未被明确忽略

- 风险：未来开发者可能误提交 `.env`、私钥或签名证书。
- 修复：`.gitignore` 增加 `.env*`、PEM / KEY / P12 / PFX，但保留可提交的 `.env.example`。项目当前没有环境变量配置，也没有发现真实密钥，因此未创建空的 `.env.example`。

### SEC-09：目标页判定可被任意查询值误触发

- 风险：原代码使用 `location.search.includes(...)`，只要其他参数的值中包含标记就会停止页面并覆盖 DOM。
- 修复：改为 `URLSearchParams.has('self_page_botcake_extension')`精确判定参数名。

## 密钥与凭据扫描

- 扫描了当前文件和全部 6 个 Git 提交中的常见云厂商 Key、GitHub Token、Slack Token、JWT、私钥头、密码 / token 赋值和敏感文件名。
- 结果：未发现真实凭据；没有被 Git 跟踪的 `.env` 或证书文件。
- 如果日后发现曾经提交或发布的密钥，必须在对应平台作废并重新生成；仅从代码或 Git 历史中删除不能使已泄露密钥失效。

## 需要开发者决定

### 决策 A：令牌是否改用请求头

1. **建议**：先在测试账号验证私有 `/api/v1/pages` 和 `/customers` 端点是否支持 `user-access-token` 或 `access-token` 请求头；支持后删除 URL 中的 `access_token`。
2. 如果私有 API 仅支持查询参数，联系 Botcake 增加 header 鉴权，并确认服务器 / 代理对查询字段做脱敏。
3. 继续使用 URL token：兼容性最高，但保留日志泄露风险，不建议作为长期方案。

### 决策 B：是否把 UI 迁移到扩展隔离页面

1. **建议**：迁移到扩展自身页面，令牌存入 `chrome.storage.session`（优先）或 `chrome.storage.local`；如需自动读 Cookie，显式申请 `cookies` + Botcake host permission。优点是安全边界清晰；缺点是安装 / 升级时可能出现新权限提示。
2. 小改方案：保持现有主世界 UI，但手动 token 只保留在内存 / `sessionStorage`。优点是改动小；缺点是页面刷新后需重新输入，且仍没有扩展源隔离。
3. 保持当前 `localStorage`：体验不变，但任意 Botcake 同源脚本都可读取手动 token，不建议。

## 验证记录

| 检查 | 结果 |
| --- | --- |
| `npm ci --ignore-scripts` | 通过，安装 65 个包 |
| `npm audit` | 通过，0 漏洞 |
| OSV 精确版本 Query Batch | 89 个包记录，0 命中 |
| `npm run build` | 通过，Vite 8.3.5，3,148 个模块 |
| `dist/manifest.json` JSON 解析 | 通过 |
| ZIP 产物根目录 | 通过，根目录包含 `manifest.json` |
| 项目自带测试 | 未提供 `test` / `lint` 脚本，无法执行 |

构建只有一条非安全性警告：`popup.js` 约 1.49 MB，超过 Vite 默认 500 KB 提示线。这会影响加载性能，不是本次安全漏洞。

## 后续建议

1. 尽快回复上述两个令牌决策，优先完成 header 兼容性测试和扩展页面迁移。
2. 启用 Dependabot 或 Renovate，与已加入 CI 的 `npm audit --audit-level=high` 配合。
3. 为 token 读取、API 失败、损坏本地存储、分页以及构建产物 Manifest 增加自动化测试。
4. 使用受保护的 release environment / tag 规则，限制谁可创建 `v*` tag。
5. 定期重新运行 npm audit、OSV 查询、密钥扫描和 Chrome Web Store 权限审查。
