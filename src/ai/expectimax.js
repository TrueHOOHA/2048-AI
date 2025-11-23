import { Evaluator } from './evaluator.js';

/**
 * Expectimax算法实现
 * 用于2048游戏AI决策
 */
export class ExpectimaxAI {
    constructor(depth = 5) {
        this.depth = depth;
        this.evaluator = new Evaluator();
        this.nodesEvaluated = 0;
        // 转置表，用于缓存评估过的局面
        this.transpositionTable = new Map();
        // 方向权重：让AI优先考虑某些方向
        this.directionPreference = [1.05, 1.0, 0.95, 1.02]; // 右，下，左，上
    }

    /**
     * 设置搜索深度
     */
    setDepth(depth) {
        this.depth = depth;
    }

    /**
     * 获取最佳移动方向
     */
    getBestMove(game, depth = this.depth) {
        const grid = game.getGrid();
        let bestScore = -Infinity;
        let bestDirection = null;

        // 尝试所有可能的移动方向，并应用方向偏好
        for (let direction = 0; direction < 4; direction++) {
            const result = game.simulateMove(grid, direction);

            if (result.moved) {
                // 应用方向偏好权重
                const score = this.expectimax(result.grid, depth - 1, false, game) * 
                              this.directionPreference[direction] + 
                              result.scoreDelta;

                if (score > bestScore) {
                    bestScore = score;
                    bestDirection = direction;
                }
            }
        }

        return bestDirection;
    }

    /**
     * Expectimax主算法
     */
    expectimax(grid, depth, isMaxPlayer, game) {
        this.nodesEvaluated++;

        // 达到搜索深度或游戏结束时评估局面
        if (depth === 0 || !this.hasAvailableMoves(grid, game)) {
            return this.evaluator.evaluate(grid);
        }

        // 使用转置表查找是否已经评估过此局面
        const gridKey = this.gridToString(grid) + (isMaxPlayer ? "m" : "c");
        if (this.transpositionTable.has(gridKey)) {
            return this.transpositionTable.get(gridKey);
        }

        let score;

        if (isMaxPlayer) {
            // 最大化玩家（AI）的回合
            let bestScore = -Infinity;

            for (let direction = 0; direction < 4; direction++) {
                const result = game.simulateMove(grid, direction);

                if (result.moved) {
                    const moveScore = this.expectimax(result.grid, depth - 1, false, game) + result.scoreDelta;
                    bestScore = Math.max(bestScore, moveScore);
                }

                // 如果已经找到非常好的移动，可以提前中断搜索（优化）
                if (bestScore > 100000 && depth > 3) break;
            }

            score = bestScore === -Infinity ? this.evaluator.evaluate(grid) : bestScore;
        } else {
            // 随机玩家（添加新方块）的回合
            const availablePositions = this.evaluator.getAvailablePositions(grid);

            if (availablePositions.length === 0) {
                score = this.evaluator.evaluate(grid);
            } else {
                let totalScore = 0;
                // 使用启发式采样减少计算量
                const sampleSize = depth <= 2 ? Math.min(3, availablePositions.length) : 1;
                const selectedPositions = this.selectPositionsForSampling(availablePositions, grid, sampleSize);

                for (const pos of selectedPositions) {
                    // 添加2的情况（概率90%）
                    const gridWith2 = JSON.parse(JSON.stringify(grid));
                    gridWith2[pos.x][pos.y] = 2;
                    totalScore += 0.9 * this.expectimax(gridWith2, depth - 1, true, game);

                    // 添加4的情况（概率10%）
                    const gridWith4 = JSON.parse(JSON.stringify(grid));
                    gridWith4[pos.x][pos.y] = 4;
                    totalScore += 0.1 * this.expectimax(gridWith4, depth - 1, true, game);
                }

                score = totalScore / selectedPositions.length;
            }
        }

        // 存储到转置表
        this.transpositionTable.set(gridKey, score);
        return score;
    }

    /**
     * 为期望节点选择有代表性的位置进行采样
     */
    selectPositionsForSampling(positions, grid, sampleSize) {
        if (positions.length <= sampleSize) {
            return positions;
        }

        // 评估每个位置的战略重要性
        const positionScores = positions.map(pos => {
            // 检查位置附近的方块值
            let adjacentSum = 0;
            let adjacentCount = 0;

            // 检查上下左右四个方向
            const directions = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];

            for (const dir of directions) {
                const nx = pos.x + dir.x;
                const ny = pos.y + dir.y;

                if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4 && grid[nx][ny] > 0) {
                    adjacentSum += Math.log2(grid[nx][ny]);
                    adjacentCount++;
                }
            }

            // 靠近大数字或边角的位置更重要
            const edgeBonus = (pos.x === 0 || pos.x === 3 || pos.y === 0 || pos.y === 3) ? 2 : 0;
            const cornerBonus = ((pos.x === 0 || pos.x === 3) && (pos.y === 0 || pos.y === 3)) ? 3 : 0;

            return {
                pos: pos,
                score: (adjacentCount > 0 ? adjacentSum / adjacentCount : 0) + edgeBonus + cornerBonus
            };
        });

        // 按重要性排序并选择前N个
        positionScores.sort((a, b) => b.score - a.score);
        return positionScores.slice(0, sampleSize).map(item => item.pos);
    }

    /**
     * 检查是否有可用移动
     */
    hasAvailableMoves(grid, game) {
        // 检查是否有空格
        for (let x = 0; x < game.size; x++) {
            for (let y = 0; y < game.size; y++) {
                if (grid[x][y] === 0) {
                    return true;
                }
            }
        }

        // 检查相邻方块是否可合并
        for (let x = 0; x < game.size; x++) {
            for (let y = 0; y < game.size; y++) {
                const val = grid[x][y];

                // 检查右侧
                if (x < game.size - 1 && grid[x + 1][y] === val) {
                    return true;
                }

                // 检查下方
                if (y < game.size - 1 && grid[x][y + 1] === val) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 将网格转换为字符串，用于转置表
     */
    gridToString(grid) {
        return grid.map(row => row.join(',')).join(';');
    }
}