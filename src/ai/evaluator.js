/**
 * 2048游戏局面评估器
 * 负责评估游戏网格的状态价值
 */
export class Evaluator {
    constructor() {
        this.gameSize = 4;
    }

    /**
     * 评估网格状态
     */
    evaluate(grid) {
        // 多因素评估函数
        let score = 0;

        // 1. 评估空格数量
        const emptyTiles = this.getAvailablePositions(grid).length;
        score += emptyTiles * 20;

        // 2. 评估大数字位于角落的权重
        const cornerWeight = this.evaluateCornerWeight(grid);
        score += cornerWeight * 60;

        // 3. 评估单调性（方块有序排列）
        const monotonicity = this.evaluateMonotonicity(grid);
        score += monotonicity * 60;

        // 4. 评估相邻方块的平滑性
        const smoothness = this.evaluateSmoothness(grid);
        score += smoothness * 40;

        // 5. 评估蛇形模式
        if (this.getHighestTile(grid) >= 256) {
            const snakeScore = this.evaluateSnakePattern(grid);
            score += snakeScore * 1000;
        }

        // 6. 评估最大方块的值
        score += this.getHighestTile(grid) * 4;

        // 7. 评估合并机会
        const mergeOpportunities = this.evaluateMergeOpportunities(grid);
        score += mergeOpportunities * 30;

        return score;
    }

    /**
     * 获取空位置
     */
    getAvailablePositions(grid) {
        const positions = [];
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] === 0) {
                    positions.push({x, y});
                }
            }
        }
        return positions;
    }

    /**
     * 获取最大值
     */
    getHighestTile(grid) {
        let highest = 0;
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                highest = Math.max(highest, grid[x][y]);
            }
        }
        return highest;
    }

    /**
     * 评估合并机会
     */
    evaluateMergeOpportunities(grid) {
        let mergeScore = 0;

        // 检查水平相邻的相同数字
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 3; x++) {
                if (grid[x][y] !== 0 && grid[x][y] === grid[x+1][y]) {
                    mergeScore += Math.log2(grid[x][y]);
                }
            }
        }

        // 检查垂直相邻的相同数字
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                if (grid[x][y] !== 0 && grid[x][y] === grid[x][y+1]) {
                    mergeScore += Math.log2(grid[x][y]);
                }
            }
        }

        return mergeScore;
    }

    /**
     * 评估角落权重
     */
    evaluateCornerWeight(grid) {
        const corners = [
            {x: 0, y: 0}, 
            {x: 0, y: this.gameSize - 1},
            {x: this.gameSize - 1, y: 0},
            {x: this.gameSize - 1, y: this.gameSize - 1}
        ];

        let cornerScore = 0;
        let maxTile = this.getHighestTile(grid);

        for (const corner of corners) {
            // 如果最大方块在角落，加分
            if (grid[corner.x][corner.y] === maxTile) {
                cornerScore += 1.0;
            } 
            // 如果较大方块在角落，也加分但权重较低
            else if (grid[corner.x][corner.y] > maxTile / 2) {
                cornerScore += 0.5;
            }
        }

        return cornerScore;
    }

    /**
     * 评估单调性
     */
    evaluateMonotonicity(grid) {
        let scores = [0, 0, 0, 0];

        // 水平方向
        for (let y = 0; y < this.gameSize; y++) {
            for (let x = 0; x < this.gameSize - 1; x++) {
                if (grid[x][y] !== 0 && grid[x+1][y] !== 0) {
                    // 左到右递增
                    if (grid[x][y] <= grid[x+1][y]) {
                        scores[0] += Math.log2(grid[x+1][y]) - Math.log2(grid[x][y]);
                    }
                    // 左到右递减
                    if (grid[x][y] >= grid[x+1][y]) {
                        scores[1] += Math.log2(grid[x][y]) - Math.log2(grid[x+1][y]);
                    }
                }
            }
        }

        // 垂直方向
        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize - 1; y++) {
                if (grid[x][y] !== 0 && grid[x][y+1] !== 0) {
                    // 上到下递增
                    if (grid[x][y] <= grid[x][y+1]) {
                        scores[2] += Math.log2(grid[x][y+1]) - Math.log2(grid[x][y]);
                    }
                    // 上到下递减
                    if (grid[x][y] >= grid[x][y+1]) {
                        scores[3] += Math.log2(grid[x][y]) - Math.log2(grid[x][y+1]);
                    }
                }
            }
        }

        // 取水平和垂直方向上的最佳单调性
        const horizontal = Math.max(scores[0], scores[1]);
        const vertical = Math.max(scores[2], scores[3]);

        return horizontal + vertical;
    }

    /**
     * 评估平滑性
     */
    evaluateSmoothness(grid) {
        let smoothness = 0;

        for (let x = 0; x < this.gameSize; x++) {
            for (let y = 0; y < this.gameSize; y++) {
                if (grid[x][y] !== 0) {
                    const value = Math.log2(grid[x][y]);

                    // 检查右侧方块
                    for (let x2 = x + 1; x2 < this.gameSize; x2++) {
                        if (grid[x2][y] !== 0) {
                            smoothness -= Math.abs(value - Math.log2(grid[x2][y]));
                            break;
                        }
                    }

                    // 检查下方方块
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
     * 评估蛇形模式的匹配度
     */
    evaluateSnakePattern(grid) {
        // 定义理想的蛇形路径坐标
        const snakePath = [
            {x:0, y:0}, {x:1, y:0}, {x:2, y:0}, {x:3, y:0},
            {x:3, y:1}, {x:2, y:1}, {x:1, y:1}, {x:0, y:1},
            {x:0, y:2}, {x:1, y:2}, {x:2, y:2}, {x:3, y:2},
            {x:3, y:3}, {x:2, y:3}, {x:1, y:3}, {x:0, y:3}
        ];

        // 检查非零元素的顺序是否符合蛇形
        const nonZeroValues = [];
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                if (grid[x][y] > 0) {
                    nonZeroValues.push(grid[x][y]);
                }
            }
        }

        // 排序并检查顺序
        const sortedValues = [...nonZeroValues].sort((a, b) => b - a);

        // 检查蛇形路径上前 N 个位置的值是否与排序后的值匹配
        const checkLen = Math.min(8, sortedValues.length, snakePath.length);
        let matches = 0;
        for (let i = 0; i < checkLen; i++) {
            if (grid[snakePath[i].x][snakePath[i].y] === sortedValues[i]) {
                matches++;
            }
        }

        const matchScore = checkLen > 0 ? matches / checkLen : 0;

        // 单调性匹配度
        const monotonicity = this.evaluateMonotonicity(grid);

        return (matchScore * 0.6 + monotonicity / 40 * 0.4);
    }
}