class AI {
    constructor(game) {
        this.game = game;
        this.algorithm = 'adaptive'; // 默认使用自适应算法
        this.depth = 5; // 增加默认搜索深度
        this.nodesEvaluated = 0; // 评估的节点数量
        this.timeStats = {
            expectimax: [],
            mcts: [],
            hybrid: []
        };
        // 添加转置表以缓存评估过的局面
        this.transpositionTable = new Map();
        // 方向权重：让AI优先考虑某些方向
        this.directionPreference = [1.05, 1.0, 0.95, 1.02]; // 右，下，左，上
    }
    
    setAlgorithm(algorithm) {
        this.algorithm = algorithm;
        // 每次切换算法时清空转置表
        this.transpositionTable.clear();
    }
    
    setDepth(depth) {
        this.depth = depth;
    }
    
    makeOneMove() {
        if (this.game.isGameOver()) return;
        
        const startTime = performance.now();
        this.nodesEvaluated = 0;
        // 每次移动前清空转置表，避免占用过多内存
        this.transpositionTable.clear();
        
        let direction;
        let activeAlgorithm = this.algorithm;
        
        // 如果是自适应算法，则根据局势动态选择最佳算法
        if (this.algorithm === 'adaptive') {
            activeAlgorithm = this.chooseAdaptiveAlgorithm();
            document.getElementById('current-algorithm').textContent = this.getAlgorithmName(activeAlgorithm);
        }
        
        // 根据选择的算法决定下一步
        switch (activeAlgorithm) {
            case 'expectimax':
                direction = this.expectimaxDecision();
                break;
            case 'mcts':
                direction = this.mctsDecision();
                break;
            case 'hybrid':
                direction = this.hybridDecision();
                break;
            default:
                direction = this.expectimaxDecision();
        }
        
        const endTime = performance.now();
        const timeElapsed = endTime - startTime;
        
        // 更新统计信息
        document.getElementById('ai-time').textContent = Math.round(timeElapsed);
        document.getElementById('nodes-evaluated').textContent = this.nodesEvaluated;
        
        // 更新时间统计，用于自适应算法
        if (activeAlgorithm !== 'adaptive') {
            this.timeStats[activeAlgorithm].push(timeElapsed);
            if (this.timeStats[activeAlgorithm].length > 10) {
                this.timeStats[activeAlgorithm].shift(); // 保持最近10次的统计
            }
        }
        
        // 执行最佳移动方向
        if (direction !== null) {
            this.game.move(direction);
            this.game.addRandomTile();
            this.game.checkGameStatus();
        }
    }
    
    // 自适应算法选择
    chooseAdaptiveAlgorithm() {
        const grid = this.game.getGrid();
        const highestTile = this.getHighestTile(grid);
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        
        // 优化的自适应策略:
        // 1. 游戏早期：ExpectiMax - 快速决策和权重导向
        // 2. 游戏中期：根据空格数量和最大方块权衡使用ExpectiMax或MCTS
        // 3. 游戏后期（接近胜利）：使用混合算法全力推进
        
        if (highestTile >= 1024) {
            // 接近胜利条件，使用混合算法
            return 'hybrid';
        } else if (highestTile >= 512 || emptyTiles <= 5) {
            // 达到中后期或空格少时使用MCTS进行更深入搜索
            return 'mcts';
        } else if (emptyTiles >= 12) {
            // 游戏早期使用ExpectiMax快速决策
            return 'expectimax';
        } else {
            // 中期阶段，基于当前局势平衡选择
            const orderScore = this.evaluateBoardOrder(grid);
            // 如果棋盘排列良好，用ExpectiMax加速；否则用MCTS深度探索
            return orderScore > 0.7 ? 'expectimax' : 'mcts';
        }
    }
    
    // 新增: 评估棋盘排列的有序性
    evaluateBoardOrder(grid) {
        // 检测蛇形模式的完整度
        const snakePatternScore = this.evaluateSnakePattern(grid);
        // 检测角落策略的应用程度
        const cornerStrategyScore = this.evaluateCornerStrategy(grid);
        
        return (snakePatternScore * 0.7 + cornerStrategyScore * 0.3);
    }
    
    getAverageTime(algorithm) {
        const times = this.timeStats[algorithm];
        if (times.length === 0) return 100; // 默认值
        return times.reduce((a, b) => a + b, 0) / times.length;
    }
    
    getAlgorithmName(algorithm) {
        const names = {
            'expectimax': 'ExpectiMax (期望最大值)',
            'mcts': 'MCTS (蒙特卡洛树搜索)',
            'hybrid': 'Hybrid (混合算法)',
            'adaptive': '自适应 (动态选择最佳算法)'
        };
        return names[algorithm] || algorithm;
    }
    
    // =========== ExpectiMax 算法 - 优化版 ===========
    expectimaxDecision() {
        const grid = this.game.getGrid();
        let bestScore = -Infinity;
        let bestDirection = null;
        
        // 尝试所有可能的移动方向，并应用方向偏好
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                // 应用方向偏好权重
                const score = this.expectimax(result.grid, this.depth - 1, false) * 
                              this.directionPreference[direction] + 
                              result.score;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestDirection = direction;
                }
            }
        }
        
        return bestDirection;
    }
    
    expectimax(grid, depth, isMaxPlayer) {
        this.nodesEvaluated++;
        
        // 达到搜索深度或游戏结束时评估局面
        if (depth === 0 || !this.hasAvailableMoves(grid)) {
            return this.evaluateGrid(grid);
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
                const result = this.game.simulateMove(grid, direction);
                
                if (result.moved) {
                    const moveScore = this.expectimax(result.grid, depth - 1, false) + result.score;
                    bestScore = Math.max(bestScore, moveScore);
                }
                
                // 如果已经找到非常好的移动，可以提前中断搜索（优化）
                if (bestScore > 100000 && depth > 3) break;
            }
            
            score = bestScore === -Infinity ? this.evaluateGrid(grid) : bestScore;
        } else {
            // 随机玩家（添加新方块）的回合
            const availablePositions = this.game.getAvailablePositions(grid);
            
            if (availablePositions.length === 0) {
                score = this.evaluateGrid(grid);
            } else {
                let totalScore = 0;
                // 使用启发式采样减少计算量
                const sampleSize = depth <= 2 ? Math.min(3, availablePositions.length) : 1;
                const selectedPositions = this.selectPositionsForSampling(availablePositions, grid, sampleSize);
                
                for (const pos of selectedPositions) {
                    // 添加2的情况（概率90%）
                    const gridWith2 = JSON.parse(JSON.stringify(grid));
                    gridWith2[pos.x][pos.y] = 2;
                    totalScore += 0.9 * this.expectimax(gridWith2, depth - 1, true);
                    
                    // 添加4的情况（概率10%）
                    const gridWith4 = JSON.parse(JSON.stringify(grid));
                    gridWith4[pos.x][pos.y] = 4;
                    totalScore += 0.1 * this.expectimax(gridWith4, depth - 1, true);
                }
                
                score = totalScore / selectedPositions.length;
            }
        }
        
        // 存储到转置表
        this.transpositionTable.set(gridKey, score);
        return score;
    }
    
    // 为期望节点选择有代表性的位置进行采样
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
    
    // =========== MCTS 算法 - 优化版 ===========
    mctsDecision() {
        const grid = this.game.getGrid();
        // 大幅增加模拟次数以提高精确度
        const simulations = Math.pow(2, this.depth) * 50;
        
        const stats = [0, 0, 0, 0]; // 统计四个方向的胜率
        const moves = [0, 0, 0, 0]; // 统计四个方向的有效移动次数
        const maxScores = [-Infinity, -Infinity, -Infinity, -Infinity]; // 每个方向的最大得分
        
        // 检查每个可能的移动
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                moves[direction] = 1;
                
                // 对每个可能的移动进行多次模拟
                for (let i = 0; i < simulations / 4; i++) {
                    this.nodesEvaluated++;
                    // 增加最大移动次数，确保有足够机会达成高分
                    const simulationResult = this.simulateRandomPlaythrough(result.grid, 200);
                    stats[direction] += simulationResult.score;
                    
                    // 记录每个方向的最高得分
                    if (simulationResult.score > maxScores[direction]) {
                        maxScores[direction] = simulationResult.score;
                    }
                }
            }
        }
        
        // 如果没有可用的移动
        if (moves.every(m => m === 0)) return null;
        
        // 计算每个方向的得分，现在同时考虑平均分和最高分
        let bestDirection = -1;
        let bestScore = -Infinity;
        
        for (let i = 0; i < 4; i++) {
            if (moves[i] > 0) {
                // 计算平均分
                const avgScore = stats[i] / (simulations / 4);
                // 结合平均分和最高分，重点关注高潜力方向
                const combinedScore = avgScore * 0.7 + maxScores[i] * 0.3;
                
                if (combinedScore > bestScore) {
                    bestScore = combinedScore;
                    bestDirection = i;
                }
            }
        }
        
        return bestDirection;
    }
    
    simulateRandomPlaythrough(grid, maxMoves) {
        let currentGrid = JSON.parse(JSON.stringify(grid));
        let totalScore = 0;
        let movesCount = 0;
        let highestTile = this.getHighestTile(currentGrid);
        
        // 随机玩到游戏结束或达到最大步数
        while (movesCount < maxMoves && this.hasAvailableMoves(currentGrid)) {
            // 添加策略性移动选择而非纯随机
            const direction = this.selectSmartRandomMove(currentGrid);
            
            if (direction !== -1) {
                const result = this.game.simulateMove(currentGrid, direction);
                
                if (result.moved) {
                    currentGrid = result.grid;
                    totalScore += result.score;
                    movesCount++;
                    
                    // 奖励生成高数字方块
                    const newHighest = this.getHighestTile(currentGrid);
                    if (newHighest > highestTile) {
                        totalScore += (newHighest - highestTile) * 2;
                        highestTile = newHighest;
                    }
                    
                    // 随机添加一个新方块
                    this.addRandomTileToGrid(currentGrid);
                } else {
                    // 避免无限循环
                    break;
                }
            } else {
                break;
            }
        }
        
        // 评估最终局面
        const finalEvaluation = this.evaluateGrid(currentGrid);
        
        // 如果达成2048或更高，给予极高奖励
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
            grid: currentGrid,
            highestTile: highestTile
        };
    }
    
    // 策略性随机移动，而非完全随机
    selectSmartRandomMove(grid) {
        // 计算每个方向的启发式得分
        const scores = [0, 0, 0, 0];
        const validMoves = [];
        
        for (let dir = 0; dir < 4; dir++) {
            const result = this.game.simulateMove(grid, dir);
            if (result.moved) {
                // 基础分 + 评估函数
                scores[dir] = result.score + this.quickEvaluate(result.grid);
                validMoves.push(dir);
            } else {
                scores[dir] = -Infinity;
            }
        }
        
        if (validMoves.length === 0) return -1;
        
        // 80%的情况选择最佳移动，20%随机选择（探索）
        if (Math.random() < 0.8) {
            return scores.indexOf(Math.max(...scores));
        } else {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }
    
    // 快速评估函数，用于MCTS中的快速决策
    quickEvaluate(grid) {
        // 空格数量
        const emptyCells = this.game.getAvailablePositions(grid).length;
        
        // 大数字在角落的奖励
        let cornerScore = 0;
        const corners = [{x:0, y:0}, {x:0, y:3}, {x:3, y:0}, {x:3, y:3}];
        const maxTile = this.getHighestTile(grid);
        
        for (const corner of corners) {
            if (grid[corner.x][corner.y] === maxTile) {
                cornerScore += maxTile;
            }
        }
        
        return emptyCells * 10 + cornerScore;
    }
    
    // =========== 混合算法 - 优化版 ===========
    hybridDecision() {
        const grid = this.game.getGrid();
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        const highestTile = this.getHighestTile(grid);
        
        // 高级混合策略:
        // 1. 接近2048时，使用超深度MCTS特殊策略
        // 2. 根据局面组织程度动态选择算法和参数
        
        if (highestTile >= 1024) {
            // 接近胜利，使用超强MCTS + 专注边角策略
            const savedDepth = this.depth;
            this.depth = Math.max(this.depth + 1, 6); // 临时增加深度
            const extraFocus = this.mctsWithCornerFocus();
            this.depth = savedDepth;
            return extraFocus;
        } else if (this.isSnakePatternFormed(grid)) {
            // 如果已经形成了良好的蛇形模式，使用专门的维持策略
            return this.maintainSnakePattern(grid);
        } else if (emptyTiles >= 8) {
            // 空格较多时使用改进的ExpectiMax
            const savedDepth = this.depth;
            this.depth = Math.min(this.depth + 1, 7); // 临时增加探索深度
            const direction = this.expectimaxDecision();
            this.depth = savedDepth;
            return direction;
        } else {
            // 空格少时使用增强MCTS
            return this.mctsDecision();
        }
    }
    
    // 专注于边角策略的MCTS
    mctsWithCornerFocus() {
        const grid = this.game.getGrid();
        const simulations = Math.pow(2, this.depth) * 40;
        
        const stats = [0, 0, 0, 0];
        const moves = [0, 0, 0, 0];
        
        // 特定的蛇形模式检测
        const isSnake = this.isSnakePatternFormed(grid);
        
        // 检查每个可能的移动
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                moves[direction] = 1;
                
                for (let i = 0; i < simulations / 4; i++) {
                    this.nodesEvaluated++;
                    // 使用高度专注的角落策略模拟
                    const simulationResult = this.simulateCornerFocusedPlaythrough(result.grid, 200, isSnake);
                    stats[direction] += simulationResult.score;
                    
                    // 如果某一方向能够达到2048，直接返回该方向
                    if (simulationResult.highestTile >= 2048) {
                        return direction;
                    }
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
    
    // 角落专注模拟
    simulateCornerFocusedPlaythrough(grid, maxMoves, maintainSnake) {
        let currentGrid = JSON.parse(JSON.stringify(grid));
        let totalScore = 0;
        let movesCount = 0;
        let highestTile = this.getHighestTile(currentGrid);
        const targetCorner = {x:0, y:0}; // 左上角作为目标角落
        
        while (movesCount < maxMoves && this.hasAvailableMoves(currentGrid)) {
            let direction;
            
            // 95%按策略移动，5%随机探索
            if (Math.random() < 0.95) {
                if (maintainSnake) {
                    // 维持蛇形模式
                    direction = this.getBestSnakeMove(currentGrid);
                } else {
                    // 向角落集中的移动
                    direction = this.getCornerFocusedMove(currentGrid, targetCorner);
                }
                
                // 如果策略失败，尝试普通移动
                if (direction === -1) {
                    direction = this.selectSmartRandomMove(currentGrid);
                }
            } else {
                direction = this.selectSmartRandomMove(currentGrid);
            }
            
            if (direction !== -1) {
                const result = this.game.simulateMove(currentGrid, direction);
                
                if (result.moved) {
                    currentGrid = result.grid;
                    totalScore += result.score;
                    movesCount++;
                    
                    // 大幅奖励生成高数字方块
                    const newHighest = this.getHighestTile(currentGrid);
                    if (newHighest > highestTile) {
                        totalScore += (newHighest - highestTile) * 4;
                        highestTile = newHighest;
                    }
                    
                    // 随机添加一个新方块
                    this.addRandomTileToGrid(currentGrid);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        // 额外评估高数字是否在角落
        let cornerBonus = 0;
        if (highestTile >= 512) {
            if (currentGrid[targetCorner.x][targetCorner.y] === highestTile) {
                cornerBonus = highestTile * 2;
            }
        }
        
        // 如果形成蛇形模式，给予额外奖励
        let snakeBonus = 0;
        if (this.isSnakePatternFormed(currentGrid)) {
            snakeBonus = this.evaluateSnakePattern(currentGrid) * 5000;
        }
        
        return {
            score: totalScore + cornerBonus + snakeBonus,
            moves: movesCount,
            grid: currentGrid,
            highestTile: highestTile
        };
    }
    
    // 获取最适合角落策略的移动
    getCornerFocusedMove(grid, targetCorner) {
        // 优先顺序：将最大数字保持在目标角落，同时保持单调排列
        const directions = [];
        const highest = this.getHighestTile(grid);
        
        // 找到最大数字的位置
        let maxPos = {x: -1, y: -1};
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (grid[x][y] === highest) {
                    maxPos = {x, y};
                    break;
                }
            }
        }
        
        // 如果最大数字不在目标角落，优先移动它靠近角落
        if (maxPos.x !== targetCorner.x || maxPos.y !== targetCorner.y) {
            // 水平方向优先
            if (maxPos.x > targetCorner.x) directions.push(3); // 左移
            else if (maxPos.x < targetCorner.x) directions.push(1); // 右移
            
            // 垂直方向次之
            if (maxPos.y > targetCorner.y) directions.push(0); // 上移
            else if (maxPos.y < targetCorner.y) directions.push(2); // 下移
        } else {
            // 最大数字已在角落，保持单调排列
            // 从左上角开始的蛇形排列优先顺序通常是：右、下、左、上
            directions.push(1, 2, 3, 0);
        }
        
        // 尝试按优先级移动
        for (const dir of directions) {
            const result = this.game.simulateMove(grid, dir);
            if (result.moved) {
                return dir;
            }
        }
        
        // 如果优先移动都无效，尝试任何有效移动
        for (let dir = 0; dir < 4; dir++) {
            if (!directions.includes(dir)) {
                const result = this.game.simulateMove(grid, dir);
                if (result.moved) {
                    return dir;
                }
            }
        }
        
        return -1; // 没有有效移动
    }
    
    // 检测是否形成了蛇形模式
    isSnakePatternFormed(grid) {
        const score = this.evaluateSnakePattern(grid);
        return score > 0.7; // 70%以上的匹配度视为已形成蛇形模式
    }
    
    // 评估蛇形模式的匹配度
    evaluateSnakePattern(grid) {
        // 蛇形模式：大数字在左上角，呈Z字形或螺旋形排列
        // 理想排列：16-8-4-2
        //           32-64-128-1
        //           1024-512-256-2
        //           2048-1-1-4
        
        let score = 0;
        let total = 0;
        
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
        
        // 定义理想的蛇形路径坐标
        const snakePath = [
            {x:0, y:0}, {x:1, y:0}, {x:2, y:0}, {x:3, y:0},
            {x:3, y:1}, {x:2, y:1}, {x:1, y:1}, {x:0, y:1},
            {x:0, y:2}, {x:1, y:2}, {x:2, y:2}, {x:3, y:2},
            {x:3, y:3}, {x:2, y:3}, {x:1, y:3}, {x:0, y:3}
        ];
        
        // 检查最大的几个数字是否按蛇形排列
        let valueIndex = 0;
        let matchCount = 0;
        
        for (const pos of snakePath) {
            if (valueIndex >= sortedValues.length) break;
            
            if (grid[pos.x][pos.y] === sortedValues[valueIndex]) {
                matchCount++;
                valueIndex++;
            }
        }
        
        // 计算匹配分数
        const matchScore = nonZeroValues.length > 0 ? matchCount / Math.min(8, nonZeroValues.length) : 0;
        
        // 单调性匹配度
        const monotonicity = this.evaluateMonotonicity(grid);
        
        return (matchScore * 0.6 + monotonicity / 40 * 0.4);
    }
    
    // 获取最佳维持蛇形模式的移动
    getBestSnakeMove(grid) {
        // 蛇形模式首选移动顺序
        const preferredOrder = [1, 2, 3, 0]; // 右，下，左，上
        
        // 评估每个移动后蛇形模式的保持程度
        const scores = [];
        
        for (let dir = 0; dir < 4; dir++) {
            const result = this.game.simulateMove(grid, dir);
            if (result.moved) {
                const snakeScore = this.evaluateSnakePattern(result.grid);
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
    
    // 维持蛇形模式的移动策略
    maintainSnakePattern(grid) {
        // 首先尝试最佳蛇形移动
        const snakeMove = this.getBestSnakeMove(grid);
        if (snakeMove !== -1) {
            return snakeMove;
        }
        
        // 如果没有好的蛇形移动，使用一般策略
        return this.expectimaxDecision();
    }
    
    // 评估蛇形策略效果
    evaluateCornerStrategy(grid) {
        // 检查最大数字是否在角落
        const maxTile = this.getHighestTile(grid);
        const corners = [{x:0, y:0}, {x:0, y:3}, {x:3, y:0}, {x:3, y:3}];
        
        for (const corner of corners) {
            if (grid[corner.x][corner.y] === maxTile) {
                return 1.0; // 最大数字在角落，满分
            }
        }
        
        // 检查次大数字是否在角落或次角落位置
        let secondMax = 0;
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (grid[x][y] > secondMax && grid[x][y] < maxTile) {
                    secondMax = grid[x][y];
                }
            }
        }
        
        for (const corner of corners) {
            if (grid[corner.x][corner.y] === secondMax) {
                return 0.7; // 次大数字在角落
            }
        }
        
        // 最大数字靠近角落
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (grid[x][y] === maxTile) {
                    if ((x <= 1 && y <= 1) || (x <= 1 && y >= 2) || 
                        (x >= 2 && y <= 1) || (x >= 2 && y >= 2)) {
                        return 0.4; // 靠近某个角落
                    }
                }
            }
        }
        
        return 0.1; // 没有形成角落策略
    }
    
    // =========== 辅助函数 ===========
    hasAvailableMoves(grid) {
        // 检查是否有空格
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (grid[x][y] === 0) {
                    return true;
                }
            }
        }
        
        // 检查相邻方块是否可合并
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const val = grid[x][y];
                
                // 检查右侧
                if (x < this.game.size - 1 && grid[x + 1][y] === val) {
                    return true;
                }
                
                // 检查下方
                if (y < this.game.size - 1 && grid[x][y + 1] === val) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    addRandomTileToGrid(grid) {
        const positions = this.game.getAvailablePositions(grid);
        
        if (positions.length > 0) {
            const pos = positions[Math.floor(Math.random() * positions.length)];
            grid[pos.x][pos.y] = Math.random() < 0.9 ? 2 : 4;
        }
    }
    
    getHighestTile(grid) {
        let highest = 0;
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                highest = Math.max(highest, grid[x][y]);
            }
        }
        return highest;
    }
    
    // 将网格转换为字符串，用于转置表
    gridToString(grid) {
        return grid.map(row => row.join(',')).join(';');
    }
    
    evaluateGrid(grid) {
        // 多因素评估函数 - 优化权重
        let score = 0;
        
        // 1. 评估空格数量
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        score += emptyTiles * 20; // 增加空格权重
        
        // 2. 评估大数字位于角落的权重
        const cornerWeight = this.evaluateCornerWeight(grid);
        score += cornerWeight * 60; // 增加角落策略权重
        
        // 3. 评估单调性（方块有序排列）
        const monotonicity = this.evaluateMonotonicity(grid);
        score += monotonicity * 60; // 增加单调性权重
        
        // 4. 评估相邻方块的平滑性
        const smoothness = this.evaluateSmoothness(grid);
        score += smoothness * 40; // 增加平滑性权重
        
        // 5. 评估蛇形模式
        if (this.getHighestTile(grid) >= 256) {
            const snakeScore = this.evaluateSnakePattern(grid);
            score += snakeScore * 1000; // 大幅增加蛇形模式权重
        }
        
        // 6. 评估最大方块的值
        score += this.getHighestTile(grid) * 4;
        
        // 7. 评估合并机会
        const mergeOpportunities = this.evaluateMergeOpportunities(grid);
        score += mergeOpportunities * 30;
        
        return score;
    }
    
    // 评估合并机会
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
    
    evaluateCornerWeight(grid) {
        // 检查大数字是否在角落
        const corners = [
            {x: 0, y: 0}, 
            {x: 0, y: this.game.size - 1},
            {x: this.game.size - 1, y: 0},
            {x: this.game.size - 1, y: this.game.size - 1}
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
    
    evaluateMonotonicity(grid) {
        let scores = [0, 0, 0, 0];
        
        // 水平方向
        for (let y = 0; y < this.game.size; y++) {
            for (let x = 0; x < this.game.size - 1; x++) {
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
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size - 1; y++) {
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
    
    evaluateSmoothness(grid) {
        let smoothness = 0;
        
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (grid[x][y] !== 0) {
                    const value = Math.log2(grid[x][y]);
                    
                    // 检查右侧方块
                    for (let x2 = x + 1; x2 < this.game.size; x2++) {
                        if (grid[x2][y] !== 0) {
                            smoothness -= Math.abs(value - Math.log2(grid[x2][y]));
                            break;
                        }
                    }
                    
                    // 检查下方方块
                    for (let y2 = y + 1; y2 < this.game.size; y2++) {
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
}
