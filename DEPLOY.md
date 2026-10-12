# 部署到 Cloudflare Pages + D1

本文档说明如何将「社团招新面试叫号系统」部署到 Cloudflare Pages + Pages Functions + D1 数据库。

## 前置准备

1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 安装 Node.js 18+ 和 npm
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
│   │   └── _redirects      # SPA fallback
│   └── src/
├── functions/              # Cloudflare Pages Functions
│   ├── api/
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
npx vite build --config vite.config.ts --outDir client-dist
```

构建产物会输出到 `client-dist/` 目录。wrangler.toml 中 `pages_build_output_dir` 已指向该目录。

## 步骤四：部署到 Cloudflare Pages

首次部署需要创建 Pages 项目：

```bash
npx wrangler pages deploy client-dist --project-name=interview-system
```

之后每次更新，执行：

```bash
npx vite build --config vite.config.ts --outDir client-dist
npx wrangler pages deploy client-dist
```

部署成功后，Cloudflare 会给你一个 `*.pages.dev` 的访问地址。

## 本地开发

```bash
# 先创建本地 D1 数据库（仅首次）
wrangler d1 create interview-system-db --local

# 执行 schema 到本地 D1
wrangler d1 execute interview-system-db --local --file=./schema.sql

# 构建前端
npx vite build --config vite.config.ts --outDir client-dist

# 启动本地 Pages Dev 服务器
npx wrangler pages dev client-dist --d1=DB
```

本地访问地址：`http://localhost:8788`

> **注意**：本地开发时，前端代码修改后需要重新构建才能生效。
> 如需热更新，可在另一个终端运行 `npx vite build --config vite.config.ts --outDir client-dist --watch`。

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
A: 确认 `client/public/_redirects` 文件存在且已被构建到输出目录，该文件配置了 SPA fallback。

### Q: 如何修改面试官名单？
A: 编辑 `functions/lib/candidates-handler.js` 中的 `INTERVIEWERS` 数组，重新构建并部署即可。

### Q: 如何修改管理员账号？
A: 编辑 `functions/lib/candidates-handler.js` 中的 `ADMIN_NAME` 常量，重新构建并部署。

### Q: 如何添加新的部门选项？
A: 部门选项在前端页面代码中（`client/src/pages/PreRegisterPage.tsx`），修改后重新构建前端并部署。
