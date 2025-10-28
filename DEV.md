# 开发文档（交互与接口设计）

面向微信小程序原生 + 云开发架构（TCB），聚焦 MVP 范围与“结算代理人”逻辑。

## 一、架构概述
- 前端：原生微信小程序（`WXML/WXSS/JS`），页面与组件分层。
- 云服务：微信云开发（TCB）
  - 云函数：结算计算、数据读写校验、权限控制。
  - 数据库：`trips`、`bills`、`settlements`、`agents` 等集合。
  - 存储：MVP 不使用图片（已取消账单上传）。
- 鉴权：基于 `openid`；创建者为旅行管理员，其他成员通过加入机制成为 `trip` 成员。
- 不支持：多币种与汇率、欠款提醒、账单图片上传、服务费/税费、权重模板。

## 二、页面与交互设计

### Tabbar（底部导航）
- `Home | 首页`
  - 显示用户头像、昵称（授权后）。
  - 按钮：`邀请好友参与旅行`（生成当前旅行的二维码/链接）。
  - 文本按钮：`历史记录`（跳转到历史记录页）。
- `History | 历史记录`
  - Tab：`进行中`、`已结束`；展示旅行列表（我创建/我加入）。
  - 进入旅行详情；成员均可关闭/删除。

### 其他页面与视图
- `TripCreate | 新建旅行`
  - 表单：`name`、`startDate`、`currency`（固定）；成员列表可留空，后续通过扫码/手动添加。
  - 创建成功后进入 `TripDetail`。
- `TripDetail | 旅行详情`
  - 未开始：展示“二维码扫码加入/手动添加成员”；成员均可“开始旅行”。
  - 已开始：显示总支出、按人汇总、每人净额（正=应收，负=应付）；入口：`增加账单`、`结算汇总`、`成员管理`、`代理人设置`。
  - 结算视图：展示最小现金流建议；支持折叠/展开代理人聚合；在该视图内可设置代理人（单选）+ 指定被代理成员（多选）。仅一级代理，禁止链式与多重归属。
- 说明：`成员管理` 与 `账单列表` 作为 `TripDetail` 的子视图/模块呈现，不单独作为页面。
  - 权限：任意旅行成员可新增/停用成员。
- `BillCreate | 新增账单`
  - 表单：`payer`、`amount`、`category`、`date`、`note`；选择参与分摊成员。
  - 分摊方式：`均分` 或 `自定义比例/固定金额`；实时预览各人份额与四舍五入补差。
  - 权限：任意旅行成员可新增账单。
- `BillEdit | 编辑账单`
  - 修改字段与分摊；删除账单成员均可操作；更新后触发统计与结算建议刷新。
  - 权限：任意旅行成员可编辑账单；删除仅管理员可操作。
- `SettlementView | 结算视图`
  - 展示最小现金流建议；折叠/展开代理人聚合；支持标记已支付（方式与时间）。
  - 页面内融合“结算代理设置”：选择代理人（单选）+ 指定被代理成员（多选），仅一级代理，禁止链式与多重归属；启用/停用后实时刷新建议。

### 页面状态与事件
- 列表页面：分页或增量加载；空态与错误态友好提示。
- 表单页面：金额保留到分；自定义比例需校验合计=账单金额。
- 结算视图：动态计算并缓存本地；切换代理设置时刷新计算。

## 三、数据模型（集合与字段）
- `trips`
  - `_id`、`name`、`currency`、`startDate`、`endDate?`、`status: 'created' | 'ongoing' | 'closed'`
  - `members: [{id, displayName, avatarUrl?, wxOpenid? , active}]`
  - `ownerOpenid`
  - `createdAt`、`updatedAt`
  - 备注：`status` 初始为 `created`；`members[].id` 在旅行内唯一，`wxOpenid` 可选绑定用于鉴权；关闭后只读，如需补记需重新开启。
  - 字段类型与约束：
    - `_id: string` 主键（TCB 自动生成）。
    - `name: string` 必填，长度 1–40。
    - `currency: string` 必填，示例 `CNY`（仅单币种）。
    - `startDate: string` ISO 日期（`YYYY-MM-DD`），必填。
    - `endDate?: string` ISO 日期，可空。
    - `status: 'created'|'ongoing'|'closed'` 默认 `created`，允许 `created→ongoing→closed` 流转；成员均可从 `closed` 重新开启为 `ongoing`。
    - `members[].id: string` 必填，旅行内唯一。
    - `members[].displayName: string` 必填，1–40。
    - `members[].avatarUrl?: string` 可选。
    - `members[].wxOpenid?: string` 可选，用于成员与微信账户绑定。
    - `members[].active: boolean` 默认 `true`；停用后不可参与新账单分摊。
    - `ownerOpenid: string` 必填，旅行创建者（仅记录，权限与其他成员一致）。
    - `createdAt: number` UNIX 毫秒时间戳，自动写入。
    - `updatedAt: number` UNIX 毫秒时间戳，自动写入。
- `bills`
  - `_id`、`tripId`、`payerMemberId`、`amount`、`category`、`date`、`note?`
  - `splitMethod: 'equal' | 'custom'`
  - `shares: [{memberId, shareAmount, shareRatio?}]`（以金额为准，比例仅用于编辑态）
  - 备注：金额精度到分；`shares.shareAmount` 总和必须等于 `amount`；参与者需为 `active` 成员；删除为硬删除，统计将重新计算。
  - 字段类型与约束：
    - `_id: string` 主键。
    - `tripId: string` 外键，引用 `trips._id`。
    - `payerMemberId: string` 必填，引用 `trips.members.id`。
    - `amount: number` 必填，>0，单位元（两位小数）。
    - `category: string` 必填，枚举：`food|transport|lodging|ticket|other`。
    - `date: string` ISO 日期（`YYYY-MM-DD`）。
    - `note?: string` 可选，≤200 字。
    - `splitMethod: 'equal'|'custom'` 必填。
    - `shares[].memberId: string` 必填，引用 `trips.members.id`。
    - `shares[].shareAmount: number` 必填，两位小数，合计=账单金额。
    - `shares[].shareRatio?: number` 可选，仅编辑态使用。
- `agents`
  - `_id`、`tripId`、`agentMemberId`、`delegateMemberIds: string[]`、`active: boolean`、`note?`
  - 备注：仅一级代理；禁止链式代理与多重归属；`delegateMemberIds` 不可包含 `agentMemberId`。
  - 字段类型与约束：
    - `_id: string` 主键。
    - `tripId: string` 外键，引用 `trips._id`。
    - `agentMemberId: string` 必填，引用 `trips.members.id`。
    - `delegateMemberIds: string[]` 必填，数组内每个成员唯一且属于该旅行。
    - `active: boolean` 默认 `true`；停用后不参与结算聚合。
    - `note?: string` 可选。
- `settlements`
  - `_id`、`tripId`、`fromMemberId`、`toMemberId`、`amount`
  - `status: 'suggested' | 'paid'`、`method?`、`paidAt?`
  - 说明：建议由计算生成；标记 `paid` 后保留记录。
  - 备注：由 `computeSettlement` 生成；当账单或代理配置变更时，建议需重算覆盖旧的 `suggested` 条目；`paid` 条目不自动回滚。
  - 字段类型与约束：
    - `_id: string` 主键。
    - `tripId: string` 外键，引用 `trips._id`。
    - `fromMemberId: string` 必填，引用 `trips.members.id`（付款人）。
    - `toMemberId: string` 必填，引用 `trips.members.id`（收款人或代理人）。
    - `amount: number` 必填，>0，两位小数。
    - `status: 'suggested'|'paid'` 必填。
    - `method?: string` 可选，`cash|wechat|alipay|bank|other`。
    - `paidAt?: number` 可选，UNIX 毫秒时间戳。
- `invites`
  - `_id`、`tripId`、`creatorOpenid`、`token`、`expireAt`、`usedByOpenid?`
  - `wxacodeUrl?`（二维码图片地址，存储于云存储）
  - 备注：一次性令牌；默认有效期 60 分钟；被使用后记录 `usedByOpenid`。
  - 字段类型与约束：
    - `_id: string` 主键。
    - `tripId: string` 外键，引用 `trips._id`。
    - `creatorOpenid: string` 必填。
    - `token: string` 必填，唯一索引。
    - `expireAt: number` 必填，UNIX 毫秒时间戳。
    - `usedByOpenid?: string` 可选；已被使用时写入。
    - `wxacodeUrl?: string` 可选，云存储地址。

### 字段类型约定（TCB）
- `string` 文本；`number` 为数值或时间戳；`boolean` 布尔；`array` 数组；`object` 文档。
- 日期推荐使用 `string`（ISO 日期）或 `number`（UNIX 毫秒）；两者不可混用。
- 金额统一 `number`，保留两位小数；所有计算在服务端保证精度与补差。

### 引用与完整性约束（逻辑约束）
- 所有 `tripId` 引用必须存在；`memberId` 必须属于该 `trip` 且 `active`（除历史数据）。
- 代理配置需保证 `delegateMemberIds` 不与其他代理重复；同一成员不可被多个代理代理。

### 索引建议
- `bills`: 索引 `tripId`、`date`、`payerMemberId`。
- `settlements`: 索引 `tripId`、`status`。
- `agents`: 索引 `tripId`。
- `invites`: 索引 `tripId`、`token`、`expireAt`。

## 四、接口设计（云函数）
- 通用响应
  - `success: boolean`
  - `data: any`
  - `errorCode?: 'OK' | 'INVALID_PARAM' | 'NOT_AUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR'`
  - `message?: string`

### 4.1 旅行与成员
- `createTrip`
  - 入参：`{ name, startDate, currency, members: [{displayName, avatarUrl?}] }`
  - 出参：`{ tripId }`
  - 权限：登录用户为 `ownerOpenid`。
  - 备注：初始化 `status='created'`、写入 `createdAt/updatedAt`；`currency` 创建后不可更改。
- `updateTrip`
  - 入参：`{ tripId, name?, startDate?, endDate? }`
  - 权限：旅行成员均可调用。
  - 备注：不支持修改 `currency`；更新写入 `updatedAt`。
- `updateTripStatus`
  - 入参：`{ tripId, status: 'created' | 'ongoing' | 'closed' }`
  - 说明：用于“开始旅行/结束旅行”。
  - 权限：旅行成员均可调用。
  - 备注：状态流转校验：`created→ongoing→closed`；`closed` 仅查看不可新增账单；成员均可重新开启为 `ongoing`。
- `addMember`
  - 入参：`{ tripId, member: { displayName, avatarUrl? , wxOpenid? } }`
  - 出参：`{ memberId }`
  - 权限：旅行成员均可调用（任意成员可新增成员）。
  - 备注：成员 `id` 由服务端生成；如提供 `wxOpenid` 且已存在成员绑定，返回冲突错误。
- `disableMember`
  - 入参：`{ tripId, memberId }`
  - 行为：将成员 `active=false`，不影响历史账单。
  - 权限：旅行成员均可调用。
  - 备注：后续新账单的 `shares` 不得包含该成员；服务端校验。
- `getTrip`
  - 入参：`{ tripId }`
  - 出参：`Trip` 详情含成员与统计概要（可选）。
- `listTrips`
  - 入参：`{ status?: 'ongoing' | 'closed' }`
  - 出参：旅行列表（我创建/我加入）。
  - 备注：按 `updatedAt` 倒序分页；默认 `pageSize=20`。

### 4.2 账单
- `addBill`
  - 入参：`{ tripId, payerMemberId, amount, category, date, note?, splitMethod, shares }`
  - 校验：`amount>0`；`shares` 金额合计=账单金额；参与者必须在 `members` 中且 `active`。
  - 出参：`{ billId }`
  - 权限：旅行成员均可调用（任意成员可新增账单）。
  - 备注：`equal` 模式在服务端补差到最后一人；金额统一两位小数；写入后触发统计刷新（可选缓存）。
- `updateBill`
  - 入参：同上但带 `billId`；更新后触发统计缓存刷新（可选）。
  - 权限：旅行成员均可调用（任意成员可编辑账单）。
  - 备注：若存在 `settlements` 建议，更新后应重新计算并覆盖旧的 `suggested`。
- `deleteBill`
  - 入参：`{ tripId, billId }`
  - 权限：旅行成员均可调用。
  - 备注：硬删除；返回删除计数；重新计算统计与结算建议。
- `listBills`
  - 入参：`{ tripId, filters? }`（`dateRange`、`category`、`payerMemberId`、`participantMemberId`）。
  - 出参：账单列表。
  - 备注：分页返回；默认 `page=1,pageSize=20`；按 `date` 倒序。

### 4.3 结算与代理
- `setSettlementAgent`
  - 入参：`{ tripId, agentMemberId, delegateMemberIds, active }`
  - 校验：禁止代理链与多重归属；成员必须属于该 `trip`。
  - 权限：旅行成员均可调用。
  - 备注：`delegateMemberIds` 不得包含 `agentMemberId`；同一成员不可出现在多个代理设置中；变更后需重算结算建议。
- `computeSettlement`
  - 入参：`{ tripId }`
  - 输出：
    - `netBalances: {[memberId]: number}`（每人净额）
    - `agentsApplied: { agentMemberId, delegateMemberIds }[]`
    - `suggestions: [{ fromMemberId, toMemberId, amount }]`（代理聚合后最小现金流）
  - 备注：服务端执行 `computeNetBalances→applyAgentAggregation→minimizeCashFlow`；写入/覆盖 `settlements(status='suggested')` 后返回结果。
- `listSettlements`
  - 入参：`{ tripId, status? }`
  - 出参：建议/已支付列表。
  - 备注：支持 `status` 过滤与分页；可返回统计汇总。
- `markSettlementPaid`
  - 入参：`{ tripId, settlementId, method, paidAt }`
  - 权限：旅行成员均可调用。
  - 备注：允许任意成员标记；保持幂等（重复标记返回成功）。

### 4.4 邀请与加入
- `createInvite`
  - 入参：`{ tripId, expireInMinutes? }`
  - 行为：生成 `token`，可选生成小程序码（`cloud.openapi.wxacode.getUnlimited`），返回 `wxacodeUrl`。
  - 出参：`{ token, wxacodeUrl? }`
  - 备注：默认有效期 60 分钟；同一用户可多次生成；`token` 唯一索引。
- `joinTripByToken`
  - 入参：`{ token, displayName?, avatarUrl? }`
  - 行为：校验 token 未过期、未使用；向 `trip.members` 添加当前用户（`auth.openid`），标记 `active=true`；可选记录 `joinedAt`；标记 token 已使用。
  - 出参：`{ tripId, memberId }`
  - 备注：若用户已是成员则返回已存在成员并标记 `token` 使用；防重复加入。

### 4.5 统计
- `getTripSummary`
  - 入参：`{ tripId }`
  - 出参：`{ totalSpent, byMember: [{memberId, spent, owed, net}], byCategory: [{category, total}] }`
  - 备注：来源于账单聚合与结算计算；数据可缓存（`tripId` 维度）并在账单/代理变更时刷新。

## 五、计算逻辑（服务端）
- `computeShares(bill)`
  - `equal`：金额/参与人数，保留到分；差额补到最后一人。
  - `custom`：按输入的固定金额或比例换算为金额；必须合计=账单金额。
- `computeNetBalances(tripId)`
  - 汇总每人实付与应付：`net = paid - owed`。
- `applyAgentAggregation(netBalances, agents)`
  - 将被代理成员净额聚合到代理人；被代理成员在结算建议中折叠。
- `minimizeCashFlow(netBalances)`
  - 贪心：匹配绝对值最大的正负净额，生成转账建议，直至归零。
- 输出：`suggestions` 写入 `settlements` 集合（`status='suggested'`）。

## 六、权限与安全（数据库规则建议）
- 无管理员概念：单次旅行的成员权限等同，所有操作对成员开放。
- 访问限制（思路）
  - `trips`：成员可读写基本信息与成员列表（新增/停用）；非成员不可访问。
  - `bills`：成员可读写（新增/更新/删除）。
  - `agents`：成员可读写。
  - `settlements`：成员可读；成员均可标记支付（幂等）。
- 规则示例（伪代码）
  - 读：`doc.tripMembersOpenids.contains(auth.openid)`
  - 写：`doc.tripMembersOpenids.contains(auth.openid)`
- 云函数层面二次校验：所有写操作在云函数中进行，确保调用者属于该旅行成员并校验参数合法性。

## 七、目录与命名建议
- 前端目录
  - `miniprogram/pages/home/`
  - `miniprogram/pages/history/`
  - `miniprogram/pages/trip-create/`
  - `miniprogram/pages/trip-detail/`（包含子视图：成员管理、账单列表模块）
  - `miniprogram/pages/bill-create/`
  - `miniprogram/pages/bill-edit/`
  - `miniprogram/pages/settlement-view/`（融合结算代理设置）
- 云函数目录
  - `cloudfunctions/createTrip`
  - `cloudfunctions/updateTrip`
  - `cloudfunctions/addMember`
  - `cloudfunctions/disableMember`
  - `cloudfunctions/addBill`
  - `cloudfunctions/updateBill`
  - `cloudfunctions/deleteBill`
  - `cloudfunctions/listBills`
  - `cloudfunctions/setSettlementAgent`
  - `cloudfunctions/computeSettlement`
  - `cloudfunctions/listSettlements`
  - `cloudfunctions/markSettlementPaid`
  - `cloudfunctions/getTripSummary`

## 八、错误码与异常处理
- 错误码：`INVALID_PARAM`、`NOT_AUTHORIZED`、`NOT_FOUND`、`CONFLICT`、`INTERNAL_ERROR`
- 前端处理：Toast + 说明；表单高亮错误字段；列表错误支持重试。
- 云函数日志：按 `tripId` 与 `openid` 维度记录，便于问题定位。

## 九、性能与缓存
- 本地缓存：最近打开的 `trip` 概览与成员列表（`wx.setStorage`）。
- 数据分页：账单列表按日期倒序分页；批量查询时避免一次性加载所有账单。
- 数据库索引：见上文；结算计算优先在云函数中进行。

## 十、测试与验收
- 单元测试（云函数）：
  - `computeShares` 四舍五入补差；`custom` 比例换算校验。
  - `applyAgentAggregation` 聚合正确性与边界（禁止链式）。
  - `minimizeCashFlow` 建议结果净额归零与笔数合理性。
- 集成测试：
  - 典型三人场景与代理人场景；编辑账单后统计与建议更新。
- 验收目标：
  - 创建旅行与记账顺畅；结算建议可读且笔数少；代理设置与建议联动正常。

## 十一、后续扩展（保留占位）
- 协作权限细化、离线能力、预算与偏差提醒。
- 如需多币种与汇率，将在模型与计算中统一到主币种（当前不支持）。