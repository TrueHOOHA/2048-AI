# 2048 · 智合

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README_EN.md)

一个带 AI 助手的 2048 益智游戏。使用现代 ES6 模块架构，内置高性能 Expectimax 搜索、自适应算法选择与暖色调响应式界面。

## 特性

- **AI 助手**：Expectimax 搜索（bitboard 位棋盘优化，搜索速度大幅提升）
- **自适应算法**：根据局面动态选择 Expectimax / Hybrid，避免弱算法拖累
- **可调搜索深度**：1-8 层实时调整，实时显示思考时间与评估节点数
- **流畅动画**：瓦片移动、合并、生成均有平滑动画（纯 CSS transition 驱动）
- **多线程就绪**：Web Worker 架构已就绪（`src/ai/ai-worker.js`），可在独立线程运行搜索
- **暖色质感 UI**：木质渐变棋盘 + 玻璃拟态 AI 面板，桌面/移动端自适应

## 项目结构

```
├── index.html           # 游戏主页面（入口）
├── style.css            # 样式文件
├── src/
│   ├── main.js          # 主控制器：协调游戏/AI/UI
│   ├── game/
│   │   ├── grid.js      # 网格数据结构
│   │   └── core.js      # 游戏核心逻辑（移动、合并、胜负判断）
│   ├── ai/
│   │   ├── bitboard.js      # 位棋盘核心（64-bit BigInt + 查表加速）
│   │   ├── evaluator.js     # 局面评估器（权重矩阵 + 幂值加权）
│   │   ├── expectimax.js    # Expectimax 搜索（转置表 + 剪枝）
│   │   ├── main.js          # AI 主控制器（算法选择与调度）
│   │   ├── multi-thread.js  # Web Worker 管理器
│   │   └── ai-worker.js     # 后台线程搜索（多线程就绪）
│   └── ui/
│       └── renderer.js  # 渲染器（瓦片动画 + 分数显示）
└── package.json          # 项目配置（http-server）
```

## 运行方法

```bash
npm install          # 安装 http-server（可选，也可跳过）
npx http-server -c-1 # 启动本地服务器（禁用缓存）
```

或直接用浏览器打开 `index.html`（ES module 需本地服务器支持）。

### 操作

- **方向键** 或 **WASD**：手动移动方块
- **AI 走一步**：AI 计算一步最佳移动
- **自动游戏**：AI 持续自动游玩
- **算法选择**：ExpectiMax / MCTS / Hybrid / 自适应
- **搜索深度**：1-8 层可调

## AI 算法说明

| 算法 | 说明 |
|------|------|
| **Expectimax** | 期望最大值搜索，使用 bitboard 加速 + 转置表 + 启发式采样 + 移动排序剪枝，是默认最强算法 |
| **MCTS** | 蒙特卡洛树搜索（简化随机模拟版） |
| **Hybrid** | 混合策略：高价值局面加深搜索，蛇形排列时维持蛇形 |
| **自适应** | 根据最高方块和空格数动态选择 Expectimax / Hybrid |

## 性能优化

- **Bitboard 位棋盘**：64-bit BigInt 表示棋盘，移动模拟用 65536 条预计算查表（O(1)），克隆仅复制一个整数
- **转置表**：跨步骤缓存局面评估值，带大小上限（20000 条自动清理）
- **搜索剪枝**：移动排序（右→下→左→上）+ 高分提前退出
- **Web Worker**：搜索可迁移到后台线程，主线程不阻塞

## 许可证

MIT License

---

[English README](README_EN.md)
