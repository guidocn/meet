# 部署到 Cloudflare Pages + D1

本文档说明如何将「社团招新面试叫号系统」部署到 Cloudflare Pages + Pages Functions + D1 数据库。

## 前置准备

1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 安装 Node.js 22+ 和 npm 10+（推荐使用 nvm 管理版本）
3. 安装 wrangler CLI：
   ```bash
   npm install -g wrangler
   ```
4. 登录 Cloudflare：
   ```bash
   wrangler login
   ```

## 目录结构

```
.
├── client/                 # 前端 React 应用
│   ├── index.html
│   ├── public/
│   │   └── _redirects      # 重定向规则（留空，SPA fallback 由 Functions 实现）
│   └── src/
├── functions/              # Cloudflare Pages Functions
│   ├── [[path]].js          # SPA fallback（兜底返回 index.html）
│   ├── api/
│   │   ├── health.js        # /api/health 健康检查
│   │   └── candidates/
│   │       └── [[path]].js # /api/candidates/* 路由
│   └── lib/
│       └── candidates-handler.js  # 业务逻辑（D1 数据库操作）
├── schema.sql              # D1 数据库建表语句
├── wrangler.toml           # wrangler 配置
└── DEPLOY.md               # 本文档
```

## 步骤一：创建 D1 数据库

```bash
wrangler d1 create interview-system-db
```

执行成功后，你会得到 `database_id`，把它复制到 `wrangler.toml` 中替换 `your-database-id-here`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "interview-system-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 步骤二：初始化数据库表结构

```bash
wrangler d1 execute interview-system-db --file=./schema.sql
```

执行成功后，表结构就创建好了。面试官名单和管理员账号为硬编码配置（见 `functions/lib/candidates-handler.js`），无需额外导入数据。

## 步骤三：构建前端

```bash
BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist
```

构建产物会输出到 `client-dist/` 目录。wrangler.toml 中 `pages_build_output_dir` 已指向该目录。

> **重要**：必须设置 `BUILD_TARGET=cloudflare` 环境变量，否则 basename 和静态资源路径会指向妙搭运行时路径，导致页面空白。

## 步骤四：部署到 Cloudflare Pages

### 方式 A：命令行部署（推荐）

首次部署需要创建 Pages 项目：

```bash
npx wrangler pages deploy client-dist --project-name=interview-system
```

之后每次更新，执行：

```bash
BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist
npx wrangler pages deploy client-dist
```

部署成功后，Cloudflare 会给你一个 `*.pages.dev` 的访问地址。

### 方式 B：Cloudflare 控制台在线部署（Git 连接）

1. 将代码推送到 GitHub / GitLab 仓库
2. 进入 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 选择你的仓库，点击 Begin setup
4. **构建设置**：
   - Framework preset: `None`
   - Build command: `BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist`
   - Build output directory: `client-dist`
   - Root directory: `/`（留空或填项目根目录）
5. **环境变量**（如需要）：在 Environment variables 中添加
6. 点击 Save and Deploy

部署完成后，Cloudflare 会自动触发构建并部署，后续每次 push 到主分支都会自动重新部署。

### 部署后验证

部署成功后，可以通过以下接口验证各组件是否正常工作：

1. **健康检查**：访问 `https://你的域名/api/health`，应返回 `{"status":"ok","db":true,...}`
   - `db: true` 表示 D1 数据库绑定正常
   - `db: false` 表示数据库未绑定或表不存在

2. **SPA 路由**：直接访问 `https://你的域名/console`，应正常加载页面（不 404）

3. **API 接口**：浏览器控制台 Network 面板中 `/api/candidates/*` 请求应返回 JSON，不出现 404/405

## 本地开发

```bash
# 先创建本地 D1 数据库（仅首次）
wrangler d1 create interview-system-db --local

# 执行 schema 到本地 D1
wrangler d1 execute interview-system-db --local --file=./schema.sql

# 构建前端
BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist

# 启动本地 Pages Dev 服务器
npx wrangler pages dev client-dist --d1=DB
```

本地访问地址：`http://localhost:8788`

> **注意**：本地开发时，前端代码修改后需要重新构建才能生效。
> 如需热更新，可在另一个终端运行 `BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist --watch`。

## 功能说明

### 面试官名单（硬编码）

面试官信息在 `functions/lib/candidates-handler.js` 中的 `INTERVIEWERS` 数组里定义，修改后重新部署即可生效。

- A 组：钱金怡、陈乙健、杜雯
- B 组：黄俊杰、王涛、王之乔
- C 组：李伟盛、庄煜波、袁烨
- D 组：刘代贵

### 流动人员名单

梁文燕、李旭涵、郑发、高梓恒、温嘉果、冯梓珊、何承熹

### 管理员账号

用户名：`guido`（拥有全部权限）

## 页面列表

| 路径 | 页面 | 权限 |
|------|------|------|
| `/` | 预报名/签到（首页） | 公开 |
| `/display` | 候场公示大屏 | 公开 |
| `/login` | 面试官登录 | - |
| `/checkin` | 签到分流台 | 管理员/流动人员 |
| `/interview` | 面试官工作台 | 面试官/管理员 |
| `/results` | 面试结果管理 | 仅管理员 |
| `/console` | 控制台 | 已登录 |

## 导入考生数据

部署完成后，通过管理员后台（面试结果管理页面）的 CSV 导入功能批量导入考生数据：

1. 用管理员账号 `guido` 登录，进入「结果管理」页面
2. 点击「批量导入」按钮
3. 上传 CSV 文件
4. 导入成功后，考生列表即可看到

### CSV 格式

列名（第一行为表头）：
```
name,gender,className,phone,firstDepartment,secondDepartment,acceptAdjust
```

示例：
```csv
name,gender,className,phone,firstDepartment,secondDepartment,acceptAdjust
张三,男,计算机2301班,13800138000,技术部,宣传部,是
李四,女,软件2302班,13800138001,宣传部,,否
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | 姓名 |
| gender | 否 | 性别（男/女） |
| className | 否 | 班级 |
| phone | 否 | 联系电话 |
| firstDepartment | 否 | 第一意向部门 |
| secondDepartment | 否 | 第二意向部门 |
| acceptAdjust | 否 | 是否服从调剂（是/否，默认否） |

## API 接口

所有接口均以 `/api/candidates` 为前缀。

### 公开接口（无需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/pre-register/public` | 公开预报名 |
| POST | `/public/search-by-name` | 按姓名查询考生 |
| POST | `/public/check-in` | 公开签到 |
| GET | `/public/detail/:id` | 公开获取考生详情 |
| POST | `/public/update-departments` | 公开修改意向部门 |
| GET | `/display/big-screen` | 候场大屏数据 |
| GET | `/group-counts` | 各组人数统计 |

### 管理接口（需登录）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 考生列表（分页+筛选） | 面试官/管理员 |
| POST | `/pre-register` | 后台新增考生 | 管理员 |
| POST | `/check-in` | 签到 | 管理员/流动人员 |
| POST | `/assign-group` | 分配组别 | 管理员/流动人员 |
| POST | `/reassign-group` | 改派组别 | 管理员/流动人员 |
| POST | `/batch-import` | 批量导入CSV | 管理员 |
| GET | `/stats` | 结果统计 | 管理员 |
| GET | `/export` | 导出CSV | 管理员 |
| GET | `/group/:groupName` | 组别队列 | 本组面试官/管理员 |
| PATCH | `/:id/status` | 更新状态 | 本组面试官/管理员 |
| POST | `/:id/score` | 打分 | 本组面试官/管理员 |
| POST | `/:id/approve` | 审批通过 | 管理员/流动人员 |
| POST | `/interviewer-login` | 面试官登录 | - |

## 常见问题

### Q: 部署后 API 返回 404？
A: 确认 `functions/` 目录在项目根目录，且文件名符合 Pages Functions 路由规范。首次部署后可能需要等几分钟生效。

### Q: D1 数据库连接报错？
A: 检查 `wrangler.toml` 中的 `database_id` 是否正确，以及 `binding = "DB"` 是否与代码中 `env.DB` 一致。

### Q: 本地开发时报错找不到 D1？
A: 确保执行过 `wrangler d1 create interview-system-db --local` 和 `--local --file=./schema.sql` 初始化本地数据库。

### Q: 前端刷新页面 404？
A: SPA fallback 由 `functions/[[path]].js` 实现。所有非 API 的 GET 请求，只要请求 HTML 或路径不含扩展名，都会返回 `index.html`，确保 React Router 客户端路由正常工作。确认 `functions/[[path]].js` 文件存在并随部署一起上传。

### Q: 如何修改面试官名单？
A: 编辑 `functions/lib/candidates-handler.js` 中的 `INTERVIEWERS` 数组，重新构建并部署即可。

### Q: 如何修改管理员账号？
A: 编辑 `functions/lib/candidates-handler.js` 中的 `ADMIN_NAME` 常量，重新构建并部署。

### Q: 如何添加新的部门选项？
A: 部门选项在前端页面代码中（`client/src/pages/PreRegisterPage.tsx`），修改后重新构建前端并部署。

## Cloudflare Pages 构建排障

### 问题：npm ci 失败 / 依赖下载失败

**根因**：项目 `.npmrc` 中配置了国内 npm 镜像源（`registry.npmmirror.com`），生成的 `package-lock.json` 中所有依赖的下载地址也指向该镜像。Cloudflare Pages 的构建环境位于海外，无法访问国内镜像源，导致 `npm ci` 下载依赖时超时或 404。

### 解决方案（任选其一）

#### 方案一：设置环境变量覆盖 registry（推荐，无需修改代码）

在 Cloudflare Pages 项目设置中添加环境变量：

- **变量名**：`NPM_CONFIG_REGISTRY`
- **值**：`https://registry.npmjs.org/`

添加后重新触发部署即可。npm 会优先使用环境变量指定的 registry，忽略 `.npmrc` 中的配置。

#### 方案二：删除 package-lock.json 后上传

在本地项目根目录执行：

```bash
rm package-lock.json
```

然后再上传代码到 Cloudflare Pages。Pages 检测不到 lock 文件时会自动改用 `npm install` 安装依赖，不再做严格校验。

> **注意**：删除 lock 文件会导致每次安装的依赖版本可能有细微差异（在 semver 范围内），不影响功能但可能影响可复现性。

#### 方案三：修改构建命令

如果以上方案都不适用，可以在 Cloudflare Pages 的 **Build command** 中写完整的安装+构建命令：

```
npm install --registry=https://registry.npmjs.org/ && BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist
```

> **注意**：此方案仅在 npm ci 成功但后续构建报错时有效。如果 npm ci 本身就失败（下载超时），构建命令不会被执行，请优先使用方案一或方案二。

### Node.js 版本

Cloudflare Pages 默认的 Node.js 版本可能较旧。本项目需要 Node.js 22+。

在 Cloudflare Pages 项目设置中设置环境变量：

- **变量名**：`NODE_VERSION`
- **值**：`22`

### 问题：postinstall 脚本报错 fullstack-cli: command not found

**根因**：package.json 中的 `postinstall` 脚本运行 `fullstack-cli action-plugin init`，该命令属于妙搭平台内置 CLI（`@lark-apaas/fullstack-cli`），仅在妙搭开发环境中可用。Cloudflare Pages / Functions 环境安装依赖后自动执行 postinstall，找不到该命令导致构建失败。

**症状**：
```
ERR_PNPM_PREPARE_PHASE_NO_DEPENDENCY  
fullstack-cli: command not found
```

### 解决方案（任选其一）

#### 方案一：设置环境变量跳过脚本（最简单，推荐）

在 Cloudflare Pages 项目设置中添加环境变量：

- **变量名**：`NPM_CONFIG_IGNORE_SCRIPTS`
- **值**：`true`

或（如果使用 bun/pnpm）：

- **变量名**：`NPM_CONFIG_IGNORE_SCRIPTS`
- **值**：`true`

> 这会让 npm/bun/pnpm 跳过所有生命周期脚本（preinstall、postinstall、prepare 等）。prepare 脚本只是设置 git hooks，在 Cloudflare 构建环境中不需要。

#### 方案二：手动删除 package.json 中的 postinstall 字段

在本地用编辑器打开 `package.json`，找到 `scripts` 部分，删除下面这一行：

```json
"postinstall": "fullstack-cli action-plugin init"
```

然后再上传代码到 Cloudflare Pages。

#### 方案三：在构建命令中绕过

> 注意：如果 npm install 阶段就失败了，构建命令不会被执行。此方案仅适用于已经跳过 install 阶段脚本的场景。

### 问题：build 脚本依赖 fullstack-cli

**根因**：项目默认的 `build` 脚本指向 `./scripts/build.sh`，该脚本第一步就执行 `npx fullstack-cli action-plugin init`，这是妙搭平台的插件初始化步骤，在 Cloudflare Pages 环境中不可用。

### 解决方案：直接使用 vite build

Cloudflare Pages 只需要构建前端静态资源，**不要使用** `npm run build`（那是全栈构建，包含服务端编译和依赖裁剪）。直接用 vite 构建前端即可：

| 设置项 | 值 |
|--------|----|
| Build command | `BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist` |
| Build output directory | `client-dist` |

vite.config.ts 使用的 `@lark-apaas/coding-preset-vite-react` 是标准 npm 包，会随 `npm install` 正常安装，无需额外处理。

### 问题：部署后页面空白，控制台报 basename 错误

**症状**：
```
<Router basename="/{{basename}}"> is not able to match the URL "/" because it does not start with the basename
```

**根因**：妙搭模板的 vite preset 在生产构建时做了三件事：① 向 HTML 注入 `window.__BASENAME__ = "{{basename}}"` 等 Handlebars 占位符；② 通过 `basename-injection` 插件改写入口 JS，将 `process.env.CLIENT_BASE_PATH` 替换为运行时读 `window.__BASENAME__` 的表达式；③ 将 Vite `base` 设为 `/app/<appId>/`。这些原本由妙搭运行时 vefaas 渲染时替换，但部署到 Cloudflare Pages 后没人替换，导致 React Router 的 basename 是字面字符串 `/{{basename}}`、静态资源路径也带前缀，路由匹配失败 + 资源 404，整页空白。

**解决方案**：`vite.config.ts` 中内置 `cloudflarePagesFix` 插件，从三层彻底修复：

1. **Vite base**：设置 `BUILD_TARGET=cloudflare` 环境变量时，将 `base` 强制设为 `/`，所有静态资源走根路径
2. **HTML 占位符**：构建时将 `{{basename}}`、`{{appId}}`、`{{userId}}`、`{{appName}}`、`{{appAvatar}}` 等所有 HBS 占位符全部替换为实际值
3. **JS bundle**：在 `generateBundle` 阶段扫描所有 chunk，将 `window.__BASENAME__` 的运行时读取表达式直接替换为硬编码 `"/"`

**使用方式**：构建时设置 `BUILD_TARGET=cloudflare` 环境变量：
```bash
BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist
```

在 Cloudflare Pages 控制台的 Build command 里直接设置：
```bash
BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist
```

> 另一个常见控制台报错 `Failed to init time offset: Unexpected token '<'` 来自妙搭 SDK 的监控上报模块（请求 `__runtime__/api/v1/observability/current_server_timestamp`），在 Cloudflare Pages 环境下该接口不存在因此返回 HTML。此错误不影响任何业务功能，可忽略。

### 完整的 Pages 构建设置参考

| 设置项 | 值 |
|--------|----|
| Framework preset | None |
| Build command | `BUILD_TARGET=cloudflare npx vite build --config vite.config.ts --outDir client-dist` |
| Build output directory | `client-dist` |
| Root directory | `/`（留空即可） |

**环境变量**：

| 变量名 | 值 | 说明 |
|--------|----|------|
| `NODE_VERSION` | `22` | Node.js 版本 |
| `NPM_CONFIG_REGISTRY` | `https://registry.npmjs.org/` | 覆盖 npm 镜像源 |
| `NPM_CONFIG_IGNORE_SCRIPTS` | `true` | 跳过 postinstall 等生命周期脚本 |
| `BUILD_TARGET` | `cloudflare` | 启用 Cloudflare Pages 适配（base=/、替换 HBS 占位符、硬编码 basename） |
