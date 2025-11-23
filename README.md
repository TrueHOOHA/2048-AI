# 2048 AI Game - 重构版

这是一个使用现代JavaScript模块化重构的2048游戏，包含AI算法实现。

## 项目结构

```
/workspace/
├── 2048.html          # 游戏主页面
├── style.css          # 样式文件
├── src/               # 源代码目录
│   ├── game/          # 游戏逻辑模块
│   │   ├── grid.js    # 网格管理
│   │   └── core.js    # 游戏核心逻辑
│   ├── ai/            # AI算法模块
│   │   ├── evaluator.js    # 局面评估器
│   │   ├── expectimax.js   # Expectimax算法
│   │   └── main.js         # AI主控制器
│   ├── ui/            # UI模块
│   │   └── renderer.js     # 渲染器
│   └── main.js        # 主控制器
├── package.json       # 项目配置
└── README.md          # 项目说明
```

## 模块说明

### 游戏逻辑模块 (`/src/game/`)
- `grid.js`: 管理游戏网格数据结构
- `core.js`: 实现游戏核心逻辑和移动操作

### AI算法模块 (`/src/ai/`)
- `evaluator.js`: 实现局面评估函数
- `expectimax.js`: 实现Expectimax算法
- `main.js`: 集成多种AI算法的主控制器

### UI模块 (`/src/ui/`)
- `renderer.js`: 负责游戏界面渲染

### 主控制器 (`/src/main.js`)
- 协调游戏逻辑、AI和UI组件

## 特性

- **模块化设计**: 使用ES6模块系统，代码结构清晰
- **AI算法**: 包含Expectimax、MCTS和混合算法
- **自适应策略**: 根据游戏状态动态选择最优算法
- **性能优化**: 使用转置表和启发式采样优化算法性能

## 使用方法

1. 打开 `2048.html` 文件即可在浏览器中运行游戏
2. 使用方向键或WASD进行游戏
3. 使用AI控制面板来选择不同的AI算法和调整参数

## AI算法说明

1. **Expectimax**: 基于期望最大值的经典算法
2. **MCTS**: 蒙特卡洛树搜索算法
3. **Hybrid**: 混合算法，结合多种策略
4. **Adaptive**: 自适应算法，根据局势动态选择最优策略
