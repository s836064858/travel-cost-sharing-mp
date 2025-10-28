# 旅行分摊（WeChat Mini Program）

一个用于多人旅行或聚会的花费分摊小程序，支持创建行程、记录账单、代理结算与一键生成结算建议。

## 功能概览
- 行程管理：创建、进行中、已结束的行程切换与浏览
- 成员管理：支持微信用户与命名成员，成员激活状态控制
- 账单记录：选择付款人与参与者，支持份额分摊
- 代理关系：成员可指派代理人，由代理人代表其进行结算
- 结算建议：根据账单与代理关系计算建议结算方案，支持保存最终结算

## 技术栈
- 前端：微信小程序（WXML/WXSS/JS）
- 云端：CloudBase 云函数（Node.js，`wx-server-sdk`）

## 目录结构
- `miniprogram/`：小程序源码（页面、样式、全局配置）
- `cloudfunctions/`：云函数源码（账单、行程、结算、用户等）
- `project.config.json`：开发者工具项目配置
- `project.private.config.json`：本地私有配置（已被 `.gitignore` 忽略）

## 快速上手
- 准备环境：
  - 安装微信开发者工具并启用云开发
  - 在小程序端更新云环境 ID：`miniprogram/app.js` 中 `cloud.init({ env: 'xxx' })`
- 导入项目：
  - 使用微信开发者工具打开本项目根目录
  - 在“云开发”面板开通数据库集合：`trips`、`bills`、`users`、`final_settlements` 等
- 运行与调试：
  - 在工具中直接点击预览或真机调试
  - 云函数会随代码一并上传与执行

## 关键流程
- 账单字段：
  - `payerMemberId`：付款人成员 ID（字符串）
  - `shares`：参与者数组，元素包含 `memberId` 与 `shareAmount`
- 代理关系存储：
  - 行程内成员字段 `agentMemberId`（在 `trips.members` 中），表示被代理者的代理成员 ID
- 结算计算：
  - 云函数 `computeSettlement` 从 `trips.members` 读取代理关系（`agentMemberId`），按代理聚合后进行匹配生成结算建议
  - 前端 `settlement-view` 展示建议与最终结算，支持确认并保存

## 重要页面
- `pages/history/`：
  - “已结束”的旅行会跳转到结算页面：`/pages/settlement-view/settlement-view?tripId=...`
  - “进行中”的旅行跳转到详情页：`/pages/trip-detail/trip-detail?tripId=...`
- `pages/trip-detail/`：
  - 设置代理人后会刷新行程数据并在成员列表下显示代理信息
- `pages/settlement-view/`：
  - 展示头像与昵称（无头像时展示文字头像），显示结算建议或已保存的最终结算

## 提交与忽略
- 项目根目录已有 `.gitignore`，忽略如下：
  - `node_modules/`、日志与临时文件
  - 微信开发者工具缓存、私有配置 `project.private.config.json`
  - 云函数依赖与环境文件

## 开发约定
- ID 字段使用字符串（如 openid 或 `name:name`）
- 前端展示优先使用 `nickName`，其次 `displayName`；头像使用 `avatarUrl`
- 修改云函数逻辑时保持与前端字段契合，避免不一致的字段名

## 常见问题
- 结算为空：检查账单是否完整、成员是否激活、代理关系是否设置合理（同一代理下的互相债务会被聚合抵消）
- 头像不显示：确保 `users` 集合中的 `avatarUrl` 已保存，或使用文字头像兜底

---
如需补充部署文档、数据库初始化脚本或更详细的计算示例，请提 Issue 或告诉我添加。