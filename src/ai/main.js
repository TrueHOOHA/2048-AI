import { ExpectimaxAI } from './expectimax.js';
import { Evaluator } from './evaluator.js';
import { runSearch } from './multi-thread.js';

/**
 * 2048游戏AI主类
 * 整合多种AI算法并提供统一接口
 */
export class GameAI {
    constructor(game) {
        this.game = game;
        this.algorithm = 'adaptive'; // 默认使用自适应算法
        this.depth = 5; // 默认搜索深度
        this.nodesEvaluated = 0;
        this.timeStats = {
            expectimax: [],
            mcts: [],
            hybrid: []
        };
        this.evaluator = new Evaluator();
        
        // 初始化各种算法实例
        this.expectimaxAI = new ExpectimaxAI(this.depth);
    }

    /**
     * 设置算法
     */
    setAlgorithm(algorithm) {
        this.algorithm = algorithm;
        // 每次切换算法时清空转置表
        if (this.expectimaxAI) {
            this.expectimaxAI.transpositionTable.clear();
        }
    }

    /**
     * 设置搜索深度
     */
    setDepth(depth) {
        this.depth = depth;
        if (this.expectimaxAI) {
            this.expectimaxAI.setDepth(depth);
        }
    }

    /**
     * 执行一次AI移动，返回移动方向（0-上 1-右 2-下 3-左，失败返回 null）
     */
    async makeOneMove() {
        if (this.game.isGameOver()) return null;

        const startTime = performance.now();
        this.nodesEvaluated = 0;

        let direction;
        let activeAlgorithm = this.algorithm;

        if (this.algorithm === 'adaptive') {
            activeAlgorithm = this.chooseAdaptiveAlgorithm();
            this.updateAlgorithmDisplay(activeAlgorithm);
        }

        switch (activeAlgorithm) {
            case 'expectimax':
                direction = await this.expectimaxDecision();
                break;
            case 'mcts':
                direction = this.mctsDecision();
                break;
            case 'hybrid':
                direction = await this.hybridDecision();
                break;
            default:
                direction = await this.expectimaxDecision();
        }

        const endTime = performance.now();
        this.updateStats(endTime - startTime);

        if (direction !== null) {
            this.game.move(direction);
            this.game.checkGameStatus();
            return direction;
        }
        return null;
    }

    /**
     * 自适应算法选择
     */
    chooseAdaptiveAlgorithm() {
        const grid = this.game.getGrid();
        const highestTile = this.evaluator.getHighestTile(grid);
        const emptyTiles = this.evaluator.getAvailablePositions(grid).length;

        if (highestTile >= 1024) {
            return 'hybrid';
        } else if (highestTile >= 256 || emptyTiles <= 6) {
            return 'hybrid';
        }
        return 'expectimax';
    }

    /**
     * Expectimax决策（多线程）
     */
    async expectimaxDecision() {
        const grid = this.game.getGrid();
        const result = await runSearch(grid, this.depth);
        this.nodesEvaluated = result.nodesEvaluated || 0;
        return result.direction;
    }

    /**
     * MCTS决策（简化版，完整实现需要更复杂的逻辑）
     */
    mctsDecision() {
        // 这里提供一个简化的MCTS实现
        // 在实际应用中，完整的MCTS会更复杂
        const grid = this.game.getGrid();
        const simulations = Math.pow(2, this.depth) * 50;

        const stats = [0, 0, 0, 0]; // 统计四个方向的胜率
        const moves = [0, 0, 0, 0]; // 统计四个方向的有效移动次数

        // 检查每个可能的移动
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);

            if (result.moved) {
                moves[direction] = 1;

                // 对每个可能的移动进行多次模拟
                for (let i = 0; i < simulations / 4; i++) {
                    this.nodesEvaluated++;
                    // 简化的随机模拟
                    const simulationResult = this.simulateRandomPlaythrough(result.grid, 50);
                    stats[direction] += simulationResult.score;
                }
            }
        }

        // 如果没有可用的移动
        if (moves.every(m => m === 0)) return null;

        // 计算每个方向的平均得分
        for (let i = 0; i < 4; i++) {
            if (moves[i] > 0) {
                stats[i] /= (simulations / 4);
            } else {
                stats[i] = -Infinity;
            }
        }

        // 返回得分最高的方向
        return stats.indexOf(Math.max(...stats));
    }

    /**
     * 随机模拟游戏过程
     */
    simulateRandomPlaythrough(grid, maxMoves) {
        let currentGrid = grid.map(row => [...row]);
        let totalScore = 0;
        let movesCount = 0;
        let highestTile = this.evaluator.getHighestTile(currentGrid);

        // 随机玩到游戏结束或达到最大步数
        while (movesCount < maxMoves && this.evaluator.hasAvailableMoves(currentGrid)) {
            // 随机选择一个方向
            const direction = Math.floor(Math.random() * 4);
            const result = this.game.simulateMove(currentGrid, direction);

            if (result.moved) {
                currentGrid = result.grid;
                totalScore += result.scoreDelta;
                movesCount++;

                // 奖励生成高数字方块
                const newHighest = this.evaluator.getHighestTile(currentGrid);
                if (newHighest > highestTile) {
                    totalScore += (newHighest - highestTile) * 2;
                    highestTile = newHighest;
                }

                // 添加随机方块
                this.addRandomTileToGrid(currentGrid);
            } else {
                let validMove = false;
                for (let dir = 0; dir < 4; dir++) {
                    if (dir !== direction) {
                        const testResult = this.game.simulateMove(currentGrid, dir);
                        if (testResult.moved) {
                            currentGrid = testResult.grid;
                            totalScore += testResult.scoreDelta;
                            movesCount++;
                            this.addRandomTileToGrid(currentGrid);
                            validMove = true;
                            break;
                        }
                    }
                }
                if (!validMove) break;
            }
        }

        // 评估最终局面
        const finalEvaluation = this.evaluator.evaluate(currentGrid);

        // 如果达成高分，给予额外奖励
        if (highestTile >= 2048) {
            totalScore += 100000;
        } else if (highestTile >= 1024) {
            totalScore += 20000;
        } else if (highestTile >= 512) {
            totalScore += 5000;
        }

        return {
            score: totalScore + finalEvaluation,
            moves: movesCount,
            highestTile: highestTile
        };
    }

    /**
     * 混合算法决策
     */
    async hybridDecision() {
        const grid = this.game.getGrid();
        const emptyTiles = this.evaluator.getAvailablePositions(grid).length;
        const highestTile = this.evaluator.getHighestTile(grid);

        if (highestTile >= 1024) {
            const savedDepth = this.depth;
            this.depth = Math.max(this.depth + 1, 6);
            const direction = await this.expectimaxDecision();
            this.depth = savedDepth;
            return direction;
        } else if (this.evaluator.evaluateSnakePattern(grid) > 0.7) {
            return this.maintainSnakePattern(grid);
        } else if (emptyTiles >= 8) {
            const savedDepth = this.depth;
            this.depth = Math.min(this.depth + 1, 7);
            const direction = await this.expectimaxDecision();
            this.depth = savedDepth;
            return direction;
        } else {
            const savedDepth = this.depth;
            this.depth = Math.min(this.depth + 1, 7);
            const direction = await this.expectimaxDecision();
            this.depth = savedDepth;
            return direction;
        }
    }

    /**
     * 维持蛇形模式的移动策略
     */
    maintainSnakePattern(grid) {
        // 首先尝试最佳蛇形移动
        const snakeMove = this.getBestSnakeMove(grid);
        if (snakeMove !== -1) {
            return snakeMove;
        }

        // 如果没有好的蛇形移动，使用一般策略
        return this.expectimaxDecision();
    }

    /**
     * 获取最佳维持蛇形模式的移动
     */
    getBestSnakeMove(grid) {
        // 蛇形模式首选移动顺序
        const preferredOrder = [1, 2, 3, 0]; // 右，下，左，上

        // 评估每个移动后蛇形模式的保持程度
        const scores = [];

        for (let dir = 0; dir < 4; dir++) {
            const result = this.game.simulateMove(grid, dir);
            if (result.moved) {
                const snakeScore = this.evaluator.evaluateSnakePattern(result.grid);
                scores.push({direction: dir, score: snakeScore});
            }
        }

        if (scores.length === 0) return -1;

        // 按照蛇形评分排序
        scores.sort((a, b) => b.score - a.score);

        // 如果最高分显著高于次高分，直接选择最高分
        if (scores.length > 1 && scores[0].score > scores[1].score + 0.15) {
            return scores[0].direction;
        }

        // 否则，在保持蛇形的移动中，按首选顺序选择
        for (const preferred of preferredOrder) {
            for (const item of scores) {
                if (item.direction === preferred && item.score > 0.6) { // 只选择较好保持蛇形的移动
                    return item.direction;
                }
            }
        }

        // 如果没有很好的蛇形维持移动，选择分数最高的
        return scores[0].direction;
    }

    /**
     * 更新算法显示
     */
    updateAlgorithmDisplay(algorithm) {
        const element = document.getElementById('current-algorithm');
        if (element) {
            const names = {
                'expectimax': 'ExpectiMax (期望最大值)',
                'mcts': 'MCTS (蒙特卡洛树搜索)',
                'hybrid': 'Hybrid (混合算法)',
                'adaptive': '自适应 (动态选择最佳算法)'
            };
            element.textContent = names[algorithm] || algorithm;
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(timeElapsed) {
        const timeElement = document.getElementById('ai-time');
        const nodesElement = document.getElementById('nodes-evaluated');
        
        if (timeElement) {
            timeElement.textContent = Math.round(timeElapsed);
        }
        if (nodesElement) {
            nodesElement.textContent = this.nodesEvaluated;
        }
    }

    /**
     * 添加随机方块到网格
     */
    addRandomTileToGrid(grid) {
        const positions = this.evaluator.getAvailablePositions(grid);

        if (positions.length > 0) {
            const pos = positions[Math.floor(Math.random() * positions.length)];
            grid[pos.x][pos.y] = Math.random() < 0.9 ? 2 : 4;
        }
    }
}