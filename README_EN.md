# 2048 · 智合

[![中文](https://img.shields.io/badge/lang-中文-red.svg)](README.md)

A 2048 puzzle game with an AI assistant. Built with modern ES6 modules, featuring a high-performance Expectimax search engine, adaptive algorithm selection, and a warm-textured responsive UI.

## Features

- **AI Assistant**: Expectimax search with bitboard optimization for blazing-fast decision making
- **Adaptive Algorithm**: Dynamically switches between Expectimax and Hybrid based on the board state
- **Adjustable Depth**: 1-8 levels with real-time stats (thinking time, nodes evaluated)
- **Smooth Animations**: Tile movement, merge, and spawn animations powered by CSS transitions
- **Web Worker Ready**: Search can run in a background thread (`src/ai/ai-worker.js`) to keep the UI responsive
- **Warm Texture UI**: Wood-grain board + glassmorphism AI panel, responsive on desktop and mobile

## Project Structure

```
├── index.html           # Main entry
├── style.css            # Styles
├── src/
│   ├── main.js          # Controller: coordinates game/AI/UI
│   ├── game/
│   │   ├── grid.js      # Grid data structure
│   │   └── core.js      # Game logic (move, merge, win/lose)
│   ├── ai/
│   │   ├── bitboard.js      # BitBoard core (64-bit BigInt + LUT)
│   │   ├── evaluator.js     # Board evaluator (weight matrix)
│   │   ├── expectimax.js    # Expectimax search (transposition table + pruning)
│   │   ├── main.js          # AI controller (algorithm selection)
│   │   ├── multi-thread.js  # Web Worker manager
│   │   └── ai-worker.js     # Background thread search
│   └── ui/
│       └── renderer.js  # Renderer (tile animations + score)
└── package.json
```

## Getting Started

```bash
npm install
npx http-server -c-1
```

Then open `http://localhost:8080` in your browser (ES modules require a local server, `file://` won't work).

### Controls

- **Arrow keys** or **WASD**: Manual tile movement
- **AI Step**: Let the AI calculate the best move
- **Auto Play**: Continuous AI gameplay
- **Algorithm**: Expectimax / MCTS / Hybrid / Adaptive
- **Search Depth**: 1-8 levels, adjustable in real-time

## AI Algorithms

| Algorithm | Description |
|-----------|-------------|
| **Expectimax** | Expectimax search with bitboard acceleration, transposition table, heuristic sampling, and move ordering pruning. The strongest algorithm by default. |
| **MCTS** | Monte Carlo Tree Search (simplified random simulation version) |
| **Hybrid** | Mixed strategy: deeper search for high-value boards, snake pattern maintenance |
| **Adaptive** | Dynamically selects Expectimax or Hybrid based on highest tile and empty cell count |

## Performance Optimizations

- **BitBoard**: 64-bit BigInt board representation. Move simulation uses a 65536-entry precomputed lookup table (O(1) per row). Cloning is just copying a single integer.
- **Transposition Table**: Caches board evaluations across search branches, with automatic cleanup at 20000 entries.
- **Search Pruning**: Move ordering (right → down → left → up) + early exit on high scores.
- **Web Worker**: The search can be offloaded to a background thread, keeping the main thread responsive.

## License

GNU General Public License v3.0

See [LICENSE](LICENSE) for details.

---

[中文版 README](README.md)