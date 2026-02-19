# 卸载比例门槛 — Product Requirements Document (PRD)

## Document Info
| Field | Value |
|-------|-------|
| Version | v1.0 |
| Created | 2026-02-19 |
| Last Updated | 2026-02-19 |
| Status | Draft |

## 1. Overview

### 1.1 Product/Feature Summary
在 `offloadToolResults` 执行卸载流程前增加预扫描阶段，计算可卸载字符数占全部消息总字符数的比例。当比例不足阈值（默认 20%）时，跳过卸载直接返回原始消息列表。核心目的是避免低收益卸载——当可卸载内容占比过小时，卸载带来的上下文释放效果微弱，不值得执行文件写入等副作用操作。

### 1.2 Goals
- 在卸载前增加比例门槛守卫，避免低收益卸载
- 比例门槛可通过环境变量 `OFFLOAD_RATIO_THRESHOLD` 配置，默认 0.2（20%）
- 跳过时零开销：不做深拷贝、不创建目录、不写文件，直接返回原始 messages 引用

### 1.3 Non-Goals (explicitly excluded scope)
- 不引入 token 计数逻辑，继续使用字符数近似
- 不改变现有单块 100 字符阈值逻辑（F-002）
- 不对 `OFFLOAD_RATIO_THRESHOLD` 做合法性校验（由调用方保证 0~1 范围）

## 2. Users & Scenarios

### 2.1 Target Users
| User Role | Description | Core Need |
|-----------|------------|-----------|
| Agent 开发者 | 学习/实验 Agent 上下文管理机制的开发者 | 避免无意义的卸载操作，仅在释放比例足够时才执行卸载 |

### 2.2 Core User Story
> As an Agent developer, I want the offload function to skip execution when the offloadable content ratio is too low, so that unnecessary file I/O is avoided when the context savings would be negligible.

### 2.3 Use Cases
| ID | Description | Trigger | Expected Outcome |
|----|------------|---------|-----------------|
| UC-005 | 比例充足时正常卸载 | offloadableChars / totalChars ≥ 20% | 执行现有卸载流程，返回卸载后的消息列表 |
| UC-006 | 比例不足时跳过卸载 | offloadableChars / totalChars < 20% | 跳过卸载，返回原始 messages 引用 |
| UC-007 | 空消息直接跳过 | messages 为空数组 `[]` | totalChars=0，直接跳过 |
| UC-008 | 可卸载字符为 0 直接跳过 | 无符合条件的 tool_result（即使 threshold=0） | offloadableChars=0，跳过 |

## 3. Functional Requirements

### 3.1 Feature List
| ID | Feature Name | Description | Priority |
|----|-------------|------------|----------|
| F-006 | 卸载比例门槛 | 预扫描全部消息，计算可卸载字符占比，低于阈值时跳过卸载 | Must |

### 3.2 Feature Details

#### F-006: 卸载比例门槛

**Description**: 在执行卸载循环之前，先做一次预扫描。遍历所有 messages 的 content 计算总字符数，遍历所有 tool_result 块筛选可卸载的计算可卸载字符数，当比例不足阈值时跳过卸载。

**Input**:
- 与现有 `offloadToolResults` 相同，无新增参数
  - `messages: Message[]` — Anthropic 风格的消息数组
  - `outputDir: string` — 卸载文件的输出目录
  - `writer: FileWriter` — 文件写入器接口

**Output**:
- 与现有 `OffloadResult` 相同
  - 跳过时 `messages` 为原始引用（不拷贝）
  - 跳过时 `offloadedCount: 0`、`freedChars: 0`、`files: []`

**Business Rules**:
1. 新增常量 `OFFLOAD_RATIO_THRESHOLD = parseFloat(process.env.OFFLOAD_RATIO_THRESHOLD || '0.2')`
2. 预扫描阶段 — 计算 `totalChars`：遍历所有 messages 的每个 content block，使用 `getContentCharCount` 对每个 block 的内容求和
3. 预扫描阶段 — 计算 `offloadableChars`：遍历所有 `type: "tool_result"` 的 block，筛选字符数 ≥ `OFFLOAD_CHAR_THRESHOLD` 的，对其字符数求和
4. 跳过条件（按优先级依次判断）：
   - `totalChars === 0` → 跳过
   - `offloadableChars === 0` → 跳过
   - `offloadableChars / totalChars < OFFLOAD_RATIO_THRESHOLD` → 跳过
5. 跳过时返回 `{ messages, offloadedCount: 0, freedChars: 0, files: [] }`，messages 为原始引用
6. 通过门槛后，执行现有卸载流程（F-001 ~ F-005）不变

**Error & Exception Scenarios**:
| Scenario | Trigger Condition | Expected Behavior |
|----------|------------------|-------------------|
| 空消息数组 | messages 为 `[]` | totalChars=0，直接跳过，返回原始空数组 |
| 无 tool_result | 消息中无任何 tool_result 块 | offloadableChars=0，跳过 |
| 全部 tool_result 低于单块阈值 | 所有 tool_result 字符数 < 100 | offloadableChars=0，跳过 |

**Boundary Conditions**:
- 比例恰好 = 0.2（20%）：**执行卸载**（≥ 阈值）
- 比例 = 0.199...：**跳过**（< 阈值）
- `OFFLOAD_RATIO_THRESHOLD = 0` + `offloadableChars > 0`：**执行卸载**（0 >= 0 成立，且 offloadableChars > 0）
- `OFFLOAD_RATIO_THRESHOLD = 0` + `offloadableChars = 0`：**跳过**（offloadableChars === 0 先拦截）
- `OFFLOAD_RATIO_THRESHOLD = 1`：仅当 100% 内容都可卸载时才执行

**State Behavior**:
- 预扫描为只读操作，不产生副作用
- 跳过时不写任何文件、不创建目录、不修改任何内容
- 与现有无状态设计一致

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
| Metric | Requirement | Measurement Method |
|--------|------------|-------------------|
| 预扫描开销 | O(n) 遍历，与现有卸载循环同量级 | N/A |
| 跳过时开销 | 零开销：不做深拷贝、不创建目录、不写文件 | N/A |

### 4.2 Security Requirements
- 无新增安全要求

### 4.3 Usability Requirements
- 环境变量 `OFFLOAD_RATIO_THRESHOLD` 提供配置灵活性
- 跳过行为对调用方透明，通过 `offloadedCount === 0` 即可判断

### 4.4 Compatibility Requirements
- 向后兼容：未设置 `OFFLOAD_RATIO_THRESHOLD` 环境变量时默认 0.2
- 现有 F-001 ~ F-005 逻辑不变

## 5. Constraints & Dependencies

### 5.1 Constraints
- 不引入新的外部依赖
- `OFFLOAD_RATIO_THRESHOLD` 取值范围 0~1，由调用方通过环境变量保证合法性
- F-006 作为前置守卫，通过后才进入 F-001 ~ F-005 流程

### 5.2 External Dependencies
- 无新增外部依赖

### 5.3 Assumptions
- 字符数近似足以反映 token 比例（无需精确 token 计数）
- 调用方理解 `OFFLOAD_RATIO_THRESHOLD` 的含义并合理配置

## 6. BDD Testability Check

| Dimension | Verification Question | Status |
|-----------|----------------------|--------|
| Input/Output format | 输入输出不变，跳过时 messages 为原始引用 | Pass |
| Error & exception scenarios | 空数组、无 tool_result、全低于单块阈值均已覆盖 | Pass |
| Boundary & priority rules | =20% 执行、<20% 跳过、threshold=0 两种情况已明确 | Pass |
| State behavior | 预扫描只读、跳过无副作用 | Pass |
| Verifiable granularity | 每个跳过条件可独立测试 | Pass |
| Ambiguity check | 三级跳过条件优先级明确，无隐式假设 | Pass |

## 7. Glossary
| Term | Definition |
|------|-----------|
| 卸载比例门槛 | 可卸载字符数占全部消息总字符数的比例阈值，低于此值时跳过卸载 |
| totalChars | 全部消息所有 content block 的字符数总和 |
| offloadableChars | 字符数 ≥ OFFLOAD_CHAR_THRESHOLD 的 tool_result 块的字符数总和 |
| OFFLOAD_RATIO_THRESHOLD | 卸载比例门槛值，环境变量配置，默认 0.2 |
