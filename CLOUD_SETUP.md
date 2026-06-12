# FitKeep 云开发配置指南

本项目集成了微信云开发，用于：
- 用户数据云端存储（用户信息、训练记录、自定义计划）
- AI 训练助手（DeepSeek 对接，云函数代理调用）

## 一、开通云开发环境

1. 微信开发者工具 → 顶部导航「云开发」按钮
2. 同意服务协议 → 创建云开发环境
3. 推荐选「按量付费」，免费额度即可满足个人使用
4. 复制环境 ID（形如 `cloud1-xxx`）

## 二、配置环境 ID

打开 `app.js`，把 `cloudEnv` 改成你的环境 ID：

```js
globalData: {
  cloudEnv: 'cloud1-你的环境ID'   // ← 改这里
}
```

## 三、初始化数据库集合

### 方法一：自动创建（推荐）

1. 上传 `init-db` 云函数（右键 `cloudfunctions/init-db` → 上传并部署：所有文件）
2. 在云函数控制台找到 `init-db` → 测试 → 调用一次
3. 集合 `users` / `workout_records` / `custom_plans` / `ai_conversations` 自动创建完毕

### 方法二：手动创建

云开发控制台 → 数据库 → 新建集合，依次创建上面 4 个集合即可。

### 数据库权限设置

每个集合都建议设为「仅创建者可读写」：
- 控制台 → 选中集合 → 数据权限 → 仅创建者可读写

## 四、配置 DeepSeek API Key

### 方式 A：环境变量（推荐，安全）

1. 上传 `ai-chat` 云函数（右键 `cloudfunctions/ai-chat` → 上传并部署：云端安装依赖）
2. 云函数控制台 → 选中 `ai-chat` → 配置 → 环境变量
3. 添加 Key：`DEEPSEEK_API_KEY`，Value：你的 DeepSeek API Key（`sk-xxx`）
4. 保存即生效

### 方式 B：代码内填写（仅开发测试）

打开 `cloudfunctions/ai-chat/index.js`，找到这一行：

```js
const FALLBACK_KEY = '';
```

填入你的 Key 即可。**注意：上传到生产前请改回环境变量方式，避免密钥外泄。**

## 五、上传云函数

每个云函数（`ai-chat` / `init-db`）都需要上传：

- 右键 `cloudfunctions/xxx` 文件夹 → **上传并部署：云端安装依赖**
- 等待依赖安装完成（看底部日志）

## 六、验证

1. 编译运行小程序
2. 「我的」页 → 点击「AI 训练助手」
3. 试试发送一句「今天该练什么？」
4. 收到 AI 回复 → 配置成功 ✅

## 数据集合结构

### users
```
{ _openid, nickName, avatarUrl, bio, createdAt, updatedAt }
```

### workout_records
```
{ _openid, exerciseId, exerciseName, category, type, sets, setLogs, duration, createdAt }
```

### custom_plans
```
{ _openid, planId, name, desc, days, createdAt, updatedAt }
```

### ai_conversations
```
{ _openid, messages, createdAt }
```

## 常见问题

**Q：AI 调用一直转圈？**
- 检查 `DEEPSEEK_API_KEY` 是否配置
- 云函数控制台查看 `ai-chat` 调用日志

**Q：本地能用，但数据没上云？**
- 确认 `app.js` 里的 `cloudEnv` 已填正确环境 ID
- 控制台看 console 是否打印「[云开发] 初始化成功」

**Q：DeepSeek API Key 怎么办？**
- 注册 https://platform.deepseek.com → API Keys → 创建
