/**
 * 2048游戏局面评估器
 * 基于权重矩阵 + 幂值加权的评估函数
 */
export class Evaluator {
    constructor() {
        this.gameSize = 4;
        // 权重矩阵：蛇形排列，左上角权重最高（大数字应堆在角落）
        this.weightMatrix = [
            [65536, 32768, 16384, 8192],
            [512,   1024,  2048,  4096],
            [256,   128,   64,    32],
            [2,     4,     8,     16]
        ];
    }

    /**
     * 评估网格状态
     */
    evaluate(grid) {
        let score = 0;

        // 1. 权重矩阵得分：鼓励大数字在蛇形高位
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] !== 0) {
                    score += this.weightMatrix[x][y] * grid[x][y];
                }
            }
        }

        // 2. 平滑度：相邻方块值相近（容易合并）
        score += this.evaluateSmoothness(grid) * 500;

        // 3. 空格数量：保持棋盘灵活性
        const emptyTiles = this.getAvailablePositions(grid).length;
        score += emptyTiles * 100000;

        // 4. 单调性：方块有序排列
        score += this.evaluateMonotonicity(grid) * 3000;

        // 5. 合并机会
        score += this.evaluateMergeOpportunities(grid) * 2000;

        return score;
    }

    getAvailablePositions(grid) {
        const positions = [];
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] === 0) positions.push({x, y});
            }
        }
        return positions;
    }

    getHighestTile(grid) {
        let highest = 0;
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                highest = Math.max(highest, grid[x][y]);
            }
        }
        return highest;
    }

    evaluateMergeOpportunities(grid) {
        let mergeScore = 0;
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 3; x++) {
                if (grid[x][y] !== 0 && grid[x][y] === grid[x+1][y]) {
                    mergeScore += grid[x][y];
                }
            }
        }
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                if (grid[x][y] !== 0 && grid[x][y] === grid[x][y+1]) {
                    mergeScore += grid[x][y];
                }
            }
        }
        return mergeScore;
    }

    evaluateMonotonicity(grid) {
        let monotonicity = 0;
        // 横向：奖励向右递增（配合权重矩阵左上角最大）
        for (let y = 0; y < this.gameSize; y++) {
            let current = 0;
            for (let x = 0; x < this.gameSize - 1; x++) {
                if (grid[x][y] !== 0 && grid[x+1][y] !== 0) {
                    const diff = Math.log2(grid[x+1][y]) - Math.log2(grid[x][y]);
                    // 向右递增为正（0 < 2 < 4 < ...），否则为负
                    current += (diff > 0) ? diff : diff * 2;
                }
            }
            monotonicity += current;
        }
        // 纵向：奖励向下递增
        for (let x = 0; x < this.gameSize; x++) {
            let current = 0;
            for (let y = 0; y < this.gameSize - 1; y++) {
                if (grid[x][y] !== 0 && grid[x][y+1] !== 0) {
                    const diff = Math.log2(grid[x][y+1]) - Math.log2(grid[x][y]);
                    current += (diff > 0) ? diff : diff * 2;
                }
            }
            monotonicity += current;
        }
        return monotonicity;
    }

    evaluateSmoothness(grid) {
        let smoothness = 0;
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] !== 0) {
                    const value = Math.log2(grid[x][y]);
                    for (let x2 = x + 1; x2 < this.gameSize; x2++) {
                        if (grid[x2][y] !== 0) {
                            smoothness -= Math.abs(value - Math.log2(grid[x2][y]));
                            break;
                        }
                    }
                    for (let y2 = y + 1; y2 < this.gameSize; y2++) {
                        if (grid[x][y2] !== 0) {
                            smoothness -= Math.abs(value - Math.log2(grid[x][y2]));
                            break;
                        }
                    }
                }
            }
        }
        return smoothness;
    }

    /**
     * 检查网格是否有可用移动
     */
    hasAvailableMoves(grid) {
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] === 0) return true;
            }
        }
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                const val = grid[x][y];
                if (x < this.gameSize - 1 && grid[x + 1][y] === val) return true;
                if (y < this.gameSize - 1 && grid[x][y + 1] === val) return true;
            }
        }
        return false;
    }

    /**
     * 蛇形模式得分（基于权重矩阵归一化，0~1）
     */
    evaluateSnakePattern(grid) {
        const maxWeight = this.weightMatrix[0][0];
        let score = 0;
        let total = 0;
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] !== 0) {
                    score += this.weightMatrix[x][y] * grid[x][y];
                    total += grid[x][y];
                }
            }
        }
        if (total === 0) return 0;
        return Math.min(1, score / (total * maxWeight));
    }
}