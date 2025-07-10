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
    
    // 大幅优化的自适应算法选择
    chooseAdaptiveAlgorithm() {
        const grid = this.game.getGrid();
        const highestTile = this.getHighestTile(grid);
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        const currentScore = this.game.getScore();
        
        // 更智能的自适应策略，考虑更多因素:
        // 1. 游戏阶段（早期/中期/后期/冲刺期）
        // 2. 棋盘空间利用率
        // 3. 当前模式形成情况
        // 4. 历史性能表现
        
        // 计算游戏阶段
        const gamePhase = this.determineGamePhase(highestTile, emptyTiles, currentScore);
        
        // 评估当前棋盘组织程度
        const boardOrganization = this.evaluateBoardOrganization(grid);
        
        // 根据阶段和组织程度选择算法
        switch (gamePhase) {
            case 'early':
                // 早期游戏：快速建立基础结构
                if (emptyTiles >= 10) {
                    this.depth = Math.min(this.depth, 4); // 限制深度，提高速度
                    return 'expectimax';
                } else {
                    this.depth = Math.min(this.depth, 5);
                    return boardOrganization > 0.6 ? 'expectimax' : 'mcts';
                }
                
            case 'mid':
                // 中期游戏：平衡探索和利用
                this.depth = Math.min(this.depth, 5);
                if (boardOrganization > 0.7) {
                    return 'expectimax'; // 结构良好时使用快速算法
                } else if (emptyTiles <= 4) {
                    return 'mcts'; // 空间紧张时需要深度搜索
                } else {
                    return 'hybrid'; // 一般情况使用混合算法
                }
                
            case 'late':
                // 后期游戏：追求最优解
                this.depth = Math.max(this.depth, 5);
                if (emptyTiles <= 3) {
                    return 'mcts'; // 极度紧张，需要精确计算
                } else if (this.isSnakePatternFormed(grid)) {
                    return 'hybrid'; // 已形成蛇形，使用混合维持
                } else {
                    return 'mcts'; // 需要形成蛇形
                }
                
            case 'endgame':
                // 冲刺期：全力达成目标
                this.depth = Math.max(this.depth, 6);
                return 'hybrid'; // 使用最强算法
                
            default:
                return 'expectimax';
        }
    }
    
    // 新增：确定游戏阶段
    determineGamePhase(highestTile, emptyTiles, currentScore) {
        // 根据最高方块值和分数判断游戏阶段
        if (highestTile >= 1024) {
            return 'endgame'; // 冲刺2048
        } else if (highestTile >= 512 || currentScore >= 5000) {
            return 'late'; // 后期
        } else if (highestTile >= 128 || currentScore >= 1000 || emptyTiles <= 8) {
            return 'mid'; // 中期
        } else {
            return 'early'; // 早期
        }
    }
    
    // 增强的棋盘组织程度评估
    evaluateBoardOrganization(grid) {
        // 综合多个指标评估棋盘的组织程度
        
        // 1. 蛇形模式完成度
        const snakeScore = this.evaluateSnakePattern(grid);
        
        // 2. 角落策略应用程度
        const cornerScore = this.evaluateCornerStrategy(grid);
        
        // 3. 单调性评估
        const monotonicity = this.evaluateMonotonicity(grid);
        const normalizedMonotonicity = Math.min(1.0, monotonicity / 50);
        
        // 4. 高值方块聚集度
        const clustering = this.evaluateHighValueClustering(grid);
        const normalizedClustering = Math.min(1.0, clustering / 20);
        
        // 5. 边缘利用率
        const edgeScore = this.evaluateEdgeStrategy(grid);
        const normalizedEdgeScore = Math.min(1.0, Math.max(0, edgeScore) / 15);
        
        // 综合评分
        const organization = (
            snakeScore * 0.3 +
            cornerScore * 0.25 +
            normalizedMonotonicity * 0.2 +
            normalizedClustering * 0.15 +
            normalizedEdgeScore * 0.1
        );
        
        return Math.min(1.0, Math.max(0.0, organization));
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
    
    // =========== ExpectiMax 算法 - 大幅优化版 ===========
    expectimaxDecision() {
        const grid = this.game.getGrid();
        let bestScore = -Infinity;
        let bestDirection = null;
        
        // 预评估所有方向，用于更好的排序
        const moveEvaluations = [];
        
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                // 快速预评估
                const quickScore = this.quickEvaluate(result.grid) + result.score;
                moveEvaluations.push({
                    direction: direction,
                    grid: result.grid,
                    score: result.score,
                    quickScore: quickScore
                });
            }
        }
        
        // 按预评估分数排序，优先搜索更有希望的移动
        moveEvaluations.sort((a, b) => b.quickScore - a.quickScore);
        
        // 搜索排序后的移动
        for (const move of moveEvaluations) {
            // 应用方向偏好权重和启发式加速
            const score = this.expectimax(move.grid, this.depth - 1, false, -Infinity, Infinity) * 
                          this.directionPreference[move.direction] + 
                          move.score;
            
            if (score > bestScore) {
                bestScore = score;
                bestDirection = move.direction;
            }
            
            // 如果发现非常好的移动，可以提前停止（在高深度时）
            if (this.depth >= 6 && score > bestScore * 1.5) {
                break;
            }
        }
        
        return bestDirection;
    }
    
    expectimax(grid, depth, isMaxPlayer, alpha = -Infinity, beta = Infinity) {
        this.nodesEvaluated++;
        
        // 达到搜索深度或游戏结束时评估局面
        if (depth === 0 || !this.hasAvailableMoves(grid)) {
            return this.evaluateGrid(grid);
        }
        
        // 使用转置表查找是否已经评估过此局面
        const gridKey = this.gridToString(grid) + (isMaxPlayer ? "m" : "c") + depth;
        if (this.transpositionTable.has(gridKey)) {
            return this.transpositionTable.get(gridKey);
        }
        
        let score;
        
        if (isMaxPlayer) {
            // 最大化玩家（AI）的回合
            let bestScore = -Infinity;
            
            // 获取并排序移动
            const moves = this.getOrderedMoves(grid);
            
            for (const move of moves) {
                const moveScore = this.expectimax(move.grid, depth - 1, false, alpha, beta) + move.score;
                bestScore = Math.max(bestScore, moveScore);
                
                // Alpha-Beta 类似的剪枝（虽然ExpectiMax通常不用，但在这里可以提供一些加速）
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha && depth > 2) {
                    break; // 剪枝
                }
                
                // 如果已经找到非常好的移动，可以提前中断搜索
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
                // 使用更智能的采样策略
                const sampleSize = this.getSampleSize(depth, availablePositions.length);
                const selectedPositions = this.selectPositionsForSampling(availablePositions, grid, sampleSize);
                
                for (const pos of selectedPositions) {
                    // 添加2的情况（概率90%）
                    const gridWith2 = JSON.parse(JSON.stringify(grid));
                    gridWith2[pos.x][pos.y] = 2;
                    totalScore += 0.9 * this.expectimax(gridWith2, depth - 1, true, alpha, beta);
                    
                    // 添加4的情况（概率10%）
                    const gridWith4 = JSON.parse(JSON.stringify(grid));
                    gridWith4[pos.x][pos.y] = 4;
                    totalScore += 0.1 * this.expectimax(gridWith4, depth - 1, true, alpha, beta);
                }
                
                score = totalScore / selectedPositions.length;
            }
        }
        
        // 存储到转置表
        this.transpositionTable.set(gridKey, score);
        return score;
    }
    
    // 新增：获取排序后的移动
    getOrderedMoves(grid) {
        const moves = [];
        
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                const quickScore = this.quickEvaluate(result.grid);
                moves.push({
                    direction: direction,
                    grid: result.grid,
                    score: result.score,
                    quickScore: quickScore
                });
            }
        }
        
        // 按快速评估分数排序
        moves.sort((a, b) => b.quickScore - a.quickScore);
        return moves;
    }
    
    // 新增：动态采样大小
    getSampleSize(depth, availablePositions) {
        if (depth <= 1) {
            return Math.min(2, availablePositions);
        } else if (depth <= 3) {
            return Math.min(3, availablePositions);
        } else {
            return Math.min(4, availablePositions);
        }
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
    
    // =========== MCTS 算法 - 大幅优化版 ===========
    mctsDecision() {
        const grid = this.game.getGrid();
        // 动态调整模拟次数
        const baseSimulations = Math.pow(2, this.depth) * 30;
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        const adaptiveSimulations = baseSimulations * (emptyTiles < 4 ? 2 : 1); // 空间紧张时增加模拟
        
        const stats = [0, 0, 0, 0]; // 统计四个方向的总得分
        const visits = [0, 0, 0, 0]; // 统计四个方向的访问次数
        const maxScores = [-Infinity, -Infinity, -Infinity, -Infinity]; // 每个方向的最大得分
        const validMoves = [];
        
        // 检查可行移动
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            if (result.moved) {
                validMoves.push(direction);
            }
        }
        
        if (validMoves.length === 0) return null;
        
        // UCB1算法进行多臂赌博机选择
        for (let simulation = 0; simulation < adaptiveSimulations; simulation++) {
            this.nodesEvaluated++;
            
            // 选择要探索的方向（使用UCB1策略）
            const direction = this.selectMoveUCB1(validMoves, stats, visits, simulation);
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                // 使用改进的rollout策略
                const simulationResult = this.enhancedSimulatePlaythrough(result.grid, 150);
                const finalScore = simulationResult.score + result.score;
                
                stats[direction] += finalScore;
                visits[direction]++;
                
                // 记录每个方向的最高得分
                if (finalScore > maxScores[direction]) {
                    maxScores[direction] = finalScore;
                }
            }
        }
        
        // 使用改进的选择策略
        return this.selectBestMoveFromStats(validMoves, stats, visits, maxScores);
    }
    
    // 新增：UCB1选择策略
    selectMoveUCB1(validMoves, stats, visits, totalSimulations) {
        if (totalSimulations < validMoves.length * 10) {
            // 初期确保每个移动都有足够的尝试
            return validMoves[totalSimulations % validMoves.length];
        }
        
        let bestUCB = -Infinity;
        let bestMove = validMoves[0];
        
        for (const move of validMoves) {
            if (visits[move] === 0) {
                return move; // 优先探索未访问的移动
            }
            
            const avgScore = stats[move] / visits[move];
            const exploration = Math.sqrt(2 * Math.log(totalSimulations) / visits[move]);
            const ucbValue = avgScore + exploration * 100; // 调整探索常数
            
            if (ucbValue > bestUCB) {
                bestUCB = ucbValue;
                bestMove = move;
            }
        }
        
        return bestMove;
    }
    
    // 新增：改进的最佳移动选择
    selectBestMoveFromStats(validMoves, stats, visits, maxScores) {
        let bestMove = -1;
        let bestValue = -Infinity;
        
        for (const move of validMoves) {
            if (visits[move] > 0) {
                const avgScore = stats[move] / visits[move];
                const maxScore = maxScores[move];
                const reliability = Math.min(1.0, visits[move] / 50); // 访问次数可靠性
                
                // 综合考虑平均分、最高分和可靠性
                const combinedValue = avgScore * 0.5 + maxScore * 0.3 + reliability * avgScore * 0.2;
                
                if (combinedValue > bestValue) {
                    bestValue = combinedValue;
                    bestMove = move;
                }
            }
        }
        
        return bestMove;
    }
    
    // 增强的模拟游戏流程
    enhancedSimulatePlaythrough(grid, maxMoves) {
        let currentGrid = JSON.parse(JSON.stringify(grid));
        let totalScore = 0;
        let movesCount = 0;
        let highestTile = this.getHighestTile(currentGrid);
        const initialHighest = highestTile;
        
        // 使用更智能的移动策略
        while (movesCount < maxMoves && this.hasAvailableMoves(currentGrid)) {
            let direction;
            
            // 采用多阶段策略
            if (movesCount < maxMoves * 0.7) {
                // 前70%使用智能启发式
                direction = this.selectInformedRandomMove(currentGrid);
            } else {
                // 后30%使用更保守的策略
                direction = this.selectConservativeMove(currentGrid);
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
                        const improvement = newHighest / highestTile;
                        totalScore += (newHighest - highestTile) * improvement * 2;
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
        
        // 最终评估加成
        const finalEvaluation = this.evaluateGrid(currentGrid);
        const progressBonus = (highestTile / initialHighest - 1) * 1000;
        
        // 达成里程碑的特别奖励
        let milestoneBonus = 0;
        if (highestTile >= 2048) {
            milestoneBonus = 200000;
        } else if (highestTile >= 1024) {
            milestoneBonus = 50000;
        } else if (highestTile >= 512) {
            milestoneBonus = 15000;
        } else if (highestTile >= 256) {
            milestoneBonus = 5000;
        }
        
        return {
            score: totalScore + finalEvaluation + progressBonus + milestoneBonus,
            moves: movesCount,
            grid: currentGrid,
            highestTile: highestTile
        };
    }
    
    // 新增：智能的启发式移动选择
    selectInformedRandomMove(grid) {
        const moveScores = [];
        
        for (let dir = 0; dir < 4; dir++) {
            const result = this.game.simulateMove(grid, dir);
            if (result.moved) {
                // 多因素评分
                let score = result.score * 2; // 即时得分
                score += this.quickEvaluate(result.grid); // 位置评估
                
                // 检查是否保持或改善蛇形模式
                const snakeScore = this.evaluateSnakePattern(result.grid);
                score += snakeScore * 200;
                
                // 检查角落策略
                const cornerScore = this.evaluateCornerWeight(result.grid);
                score += cornerScore * 100;
                
                moveScores.push({direction: dir, score: score});
            }
        }
        
        if (moveScores.length === 0) return -1;
        
        // 90%选择最佳，10%探索其他选项
        if (Math.random() < 0.9) {
            moveScores.sort((a, b) => b.score - a.score);
            return moveScores[0].direction;
        } else {
            return moveScores[Math.floor(Math.random() * moveScores.length)].direction;
        }
    }
    
    // 新增：保守策略移动选择
    selectConservativeMove(grid) {
        // 优先保持现有结构，避免破坏已形成的模式
        const moves = [];
        
        for (let dir = 0; dir < 4; dir++) {
            const result = this.game.simulateMove(grid, dir);
            if (result.moved) {
                // 评估移动后是否破坏现有模式
                const beforeSnake = this.evaluateSnakePattern(grid);
                const afterSnake = this.evaluateSnakePattern(result.grid);
                const beforeCorner = this.evaluateCornerWeight(grid);
                const afterCorner = this.evaluateCornerWeight(result.grid);
                
                // 计算模式保持度
                const patternPreservation = (afterSnake / Math.max(beforeSnake, 0.1)) + 
                                           (afterCorner / Math.max(beforeCorner, 0.1));
                
                moves.push({
                    direction: dir,
                    preservation: patternPreservation,
                    score: result.score + this.quickEvaluate(result.grid)
                });
            }
        }
        
        if (moves.length === 0) return -1;
        
        // 优先选择最能保持模式的移动
        moves.sort((a, b) => (b.preservation * 0.7 + b.score * 0.3) - (a.preservation * 0.7 + a.score * 0.3));
        return moves[0].direction;
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
    
    // =========== 混合算法 - 大幅增强版 ===========
    hybridDecision() {
        const grid = this.game.getGrid();
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        const highestTile = this.getHighestTile(grid);
        const currentScore = this.game.getScore();
        const boardOrganization = this.evaluateBoardOrganization(grid);
        
        // 超智能混合策略:
        // 1. 根据游戏状态动态选择主要算法
        // 2. 使用多算法投票机制
        // 3. 特殊情况下的专用策略
        
        // 特殊情况处理
        if (highestTile >= 1024 && emptyTiles <= 2) {
            // 极端冲刺阶段：使用最精确的搜索
            return this.preciseMCTSForEndgame(grid);
        }
        
        if (this.isNearGameOver(grid)) {
            // 接近游戏结束：保守策略
            return this.conservativeMove(grid);
        }
        
        // 根据时间预算和局面复杂度选择策略
        const timebudget = this.estimateTimebudget(emptyTiles, highestTile);
        
        if (timebudget === 'fast') {
            // 快速决策：使用优化的ExpectiMax
            return this.fastExpectimax(grid);
        } else if (timebudget === 'medium') {
            // 中等时间：使用算法投票
            return this.algorithmVoting(grid);
        } else {
            // 充足时间：使用最强策略
            return this.premiumHybridStrategy(grid);
        }
    }
    
    // 新增：时间预算估算
    estimateTimebudget(emptyTiles, highestTile) {
        // 根据局面复杂度估算可用计算时间
        if (emptyTiles >= 8 && highestTile < 256) {
            return 'fast'; // 早期局面，快速决策即可
        } else if (emptyTiles >= 4 && highestTile < 512) {
            return 'medium'; // 中期局面，中等计算
        } else {
            return 'full'; // 后期局面，需要深入计算
        }
    }
    
    // 新增：快速ExpectiMax
    fastExpectimax(grid) {
        const savedDepth = this.depth;
        this.depth = Math.min(this.depth, 4); // 限制深度提高速度
        const decision = this.expectimaxDecision();
        this.depth = savedDepth;
        return decision;
    }
    
    // 新增：算法投票机制
    algorithmVoting(grid) {
        const votes = {};
        const algorithms = ['expectimax', 'mcts'];
        
        // 每个算法投票
        for (const algorithm of algorithms) {
            let decision;
            const savedDepth = this.depth;
            
            if (algorithm === 'expectimax') {
                this.depth = Math.min(this.depth, 5);
                decision = this.expectimaxDecision();
            } else if (algorithm === 'mcts') {
                // 使用较少模拟的MCTS
                decision = this.lightweightMCTS(grid);
            }
            
            this.depth = savedDepth;
            
            if (decision !== null) {
                votes[decision] = (votes[decision] || 0) + 1;
            }
        }
        
        // 返回得票最多的方向
        let maxVotes = 0;
        let bestDirection = null;
        
        for (const [direction, voteCount] of Object.entries(votes)) {
            if (voteCount > maxVotes) {
                maxVotes = voteCount;
                bestDirection = parseInt(direction);
            }
        }
        
        return bestDirection;
    }
    
    // 新增：轻量级MCTS
    lightweightMCTS(grid) {
        const simulations = 200; // 减少模拟次数
        const stats = [0, 0, 0, 0];
        const visits = [0, 0, 0, 0];
        
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                for (let i = 0; i < simulations / 4; i++) {
                    const simulationResult = this.simulateRandomPlaythrough(result.grid, 100);
                    stats[direction] += simulationResult.score;
                    visits[direction]++;
                }
            }
        }
        
        let bestDirection = -1;
        let bestScore = -Infinity;
        
        for (let i = 0; i < 4; i++) {
            if (visits[i] > 0) {
                const avgScore = stats[i] / visits[i];
                if (avgScore > bestScore) {
                    bestScore = avgScore;
                    bestDirection = i;
                }
            }
        }
        
        return bestDirection;
    }
    
    // 新增：高级混合策略
    premiumHybridStrategy(grid) {
        const highestTile = this.getHighestTile(grid);
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        const boardOrganization = this.evaluateBoardOrganization(grid);
        
        // 根据局面特征选择最适合的策略
        if (boardOrganization > 0.8 && this.isSnakePatternFormed(grid)) {
            // 蛇形模式已形成且组织良好：维持策略
            return this.maintainSnakePattern(grid);
        } else if (highestTile >= 512 && emptyTiles <= 6) {
            // 高级阶段空间紧张：精确MCTS
            return this.precisionMCTS(grid);
        } else if (emptyTiles >= 10) {
            // 空间充足：使用深度ExpectiMax快速建立结构
            const savedDepth = this.depth;
            this.depth = Math.min(this.depth + 1, 6);
            const decision = this.expectimaxDecision();
            this.depth = savedDepth;
            return decision;
        } else {
            // 一般情况：混合使用两种算法
            return this.dualAlgorithmHybrid(grid);
        }
    }
    
    // 新增：精密MCTS
    precisionMCTS(grid) {
        const savedDepth = this.depth;
        this.depth = Math.max(this.depth, 6); // 增加深度
        const decision = this.mctsDecision();
        this.depth = savedDepth;
        return decision;
    }
    
    // 新增：双算法混合
    dualAlgorithmHybrid(grid) {
        // 同时运行ExpectiMax和MCTS，取结果一致或评估更高的
        const expectimaxMove = this.expectimaxDecision();
        const mctsMove = this.mctsDecision();
        
        if (expectimaxMove === mctsMove) {
            // 两个算法一致，直接返回
            return expectimaxMove;
        } else {
            // 不一致时，评估两个选择的质量
            const expectimaxResult = this.game.simulateMove(grid, expectimaxMove);
            const mctsResult = this.game.simulateMove(grid, mctsMove);
            
            let expectimaxScore = -Infinity;
            let mctsScore = -Infinity;
            
            if (expectimaxResult.moved) {
                expectimaxScore = this.evaluateGrid(expectimaxResult.grid) + expectimaxResult.score;
            }
            
            if (mctsResult.moved) {
                mctsScore = this.evaluateGrid(mctsResult.grid) + mctsResult.score;
            }
            
            return expectimaxScore >= mctsScore ? expectimaxMove : mctsMove;
        }
    }
    
    // 新增：检查是否接近游戏结束
    isNearGameOver(grid) {
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        return emptyTiles <= 2;
    }
    
    // 新增：保守移动策略
    conservativeMove(grid) {
        // 在接近游戏结束时，优先选择能保持空格或产生合并的移动
        let bestMove = -1;
        let bestScore = -Infinity;
        
        for (let direction = 0; direction < 4; direction++) {
            const result = this.game.simulateMove(grid, direction);
            
            if (result.moved) {
                let score = result.score * 3; // 重视即时得分
                
                // 重视产生的空格数量
                const newEmptyTiles = this.game.getAvailablePositions(result.grid).length;
                score += newEmptyTiles * 200;
                
                // 重视合并机会
                const mergeOpportunities = this.evaluateMergeOpportunities(result.grid);
                score += mergeOpportunities * 100;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = direction;
                }
            }
        }
        
        return bestMove;
    }
    
    // 新增：冲刺阶段精确MCTS
    preciseMCTSForEndgame(grid) {
        // 极端情况下的超精确搜索
        const savedDepth = this.depth;
        this.depth = Math.max(this.depth + 2, 8); // 大幅增加深度
        
        // 使用更多模拟次数
        const grid_copy = JSON.parse(JSON.stringify(grid));
        const decision = this.mctsDecision();
        
        this.depth = savedDepth;
        return decision;
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
    
    // 大幅增强的蛇形模式评估
    evaluateSnakePattern(grid) {
        // 多种蛇形模式检测，包括左上、右上、左下、右下起始的蛇形
        const patterns = [
            this.evaluateSnakeFromCorner(grid, {x: 0, y: 0}), // 左上角开始
            this.evaluateSnakeFromCorner(grid, {x: 0, y: 3}), // 左下角开始
            this.evaluateSnakeFromCorner(grid, {x: 3, y: 0}), // 右上角开始
            this.evaluateSnakeFromCorner(grid, {x: 3, y: 3})  // 右下角开始
        ];
        
        // 返回最佳蛇形模式得分
        const bestPattern = Math.max(...patterns);
        
        // 额外检查螺旋模式
        const spiralScore = this.evaluateSpiralPattern(grid);
        
        return Math.max(bestPattern, spiralScore * 0.8); // 螺旋模式权重稍低
    }
    
    // 新增：从指定角落评估蛇形模式
    evaluateSnakeFromCorner(grid, startCorner) {
        let score = 0;
        let pathValues = [];
        
        // 根据起始角落确定蛇形路径
        const path = this.generateSnakePath(startCorner);
        
        // 提取路径上的所有非零值
        for (const pos of path) {
            if (grid[pos.x][pos.y] > 0) {
                pathValues.push(grid[pos.x][pos.y]);
            }
        }
        
        if (pathValues.length < 2) return 0;
        
        // 检查递减趋势
        let decreasingSequence = 0;
        let maxSequence = 0;
        
        for (let i = 0; i < pathValues.length - 1; i++) {
            if (pathValues[i] >= pathValues[i + 1]) {
                decreasingSequence++;
                maxSequence = Math.max(maxSequence, decreasingSequence);
            } else {
                decreasingSequence = 0;
            }
        }
        
        // 基础得分：最长递减序列
        score += maxSequence * 0.15;
        
        // 检查2的幂次关系
        let powerRelations = 0;
        for (let i = 0; i < pathValues.length - 1; i++) {
            const ratio = pathValues[i] / pathValues[i + 1];
            if (ratio === 2) {
                powerRelations++;
                score += 0.1;
            } else if (ratio === 4) {
                powerRelations++;
                score += 0.05;
            }
        }
        
        // 奖励更长的整体模式
        if (pathValues.length >= 8) {
            score += 0.1;
        }
        
        // 检查最大值是否在起始角落
        const maxTile = this.getHighestTile(grid);
        if (grid[startCorner.x][startCorner.y] === maxTile) {
            score += 0.2;
        }
        
        return score;
    }
    
    // 新增：生成蛇形路径
    generateSnakePath(startCorner) {
        const path = [];
        
        if (startCorner.x === 0 && startCorner.y === 0) {
            // 左上角开始的Z字形
            for (let y = 0; y < 4; y++) {
                if (y % 2 === 0) {
                    for (let x = 0; x < 4; x++) path.push({x, y});
                } else {
                    for (let x = 3; x >= 0; x--) path.push({x, y});
                }
            }
        } else if (startCorner.x === 0 && startCorner.y === 3) {
            // 左下角开始的Z字形
            for (let y = 3; y >= 0; y--) {
                if ((3 - y) % 2 === 0) {
                    for (let x = 0; x < 4; x++) path.push({x, y});
                } else {
                    for (let x = 3; x >= 0; x--) path.push({x, y});
                }
            }
        } else if (startCorner.x === 3 && startCorner.y === 0) {
            // 右上角开始的Z字形
            for (let y = 0; y < 4; y++) {
                if (y % 2 === 0) {
                    for (let x = 3; x >= 0; x--) path.push({x, y});
                } else {
                    for (let x = 0; x < 4; x++) path.push({x, y});
                }
            }
        } else {
            // 右下角开始的Z字形
            for (let y = 3; y >= 0; y--) {
                if ((3 - y) % 2 === 0) {
                    for (let x = 3; x >= 0; x--) path.push({x, y});
                } else {
                    for (let x = 0; x < 4; x++) path.push({x, y});
                }
            }
        }
        
        return path;
    }
    
    // 新增：评估螺旋模式
    evaluateSpiralPattern(grid) {
        // 从外向内的螺旋路径
        const spiralPath = [
            {x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0},
            {x:3,y:1}, {x:3,y:2}, {x:3,y:3},
            {x:2,y:3}, {x:1,y:3}, {x:0,y:3},
            {x:0,y:2}, {x:0,y:1},
            {x:1,y:1}, {x:2,y:1}, {x:2,y:2}, {x:1,y:2}
        ];
        
        let spiralScore = 0;
        let pathValues = [];
        
        for (const pos of spiralPath) {
            if (grid[pos.x][pos.y] > 0) {
                pathValues.push(grid[pos.x][pos.y]);
            }
        }
        
        if (pathValues.length < 3) return 0;
        
        // 检查螺旋模式的递减趋势
        let decreasingCount = 0;
        for (let i = 0; i < pathValues.length - 1; i++) {
            if (pathValues[i] >= pathValues[i + 1]) {
                decreasingCount++;
            }
        }
        
        spiralScore = decreasingCount / (pathValues.length - 1);
        
        // 检查外圈是否有最大值
        const maxTile = this.getHighestTile(grid);
        const outerRing = [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0}, {x:3,y:1}, {x:3,y:2}, {x:3,y:3}, {x:2,y:3}, {x:1,y:3}, {x:0,y:3}, {x:0,y:2}, {x:0,y:1}];
        
        for (const pos of outerRing) {
            if (grid[pos.x][pos.y] === maxTile) {
                spiralScore += 0.2;
                break;
            }
        }
        
        return spiralScore;
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
        // 多因素评估函数 - 大幅优化权重和新增评估项
        let score = 0;
        const highestTile = this.getHighestTile(grid);
        const emptyTiles = this.game.getAvailablePositions(grid).length;
        
        // 1. 评估空格数量 - 动态权重
        const emptyWeight = emptyTiles < 4 ? 50 : 25; // 空格稀少时权重更高
        score += emptyTiles * emptyWeight;
        
        // 2. 评估大数字位于角落的权重 - 增强角落策略
        const cornerWeight = this.evaluateCornerWeight(grid);
        score += cornerWeight * 100; // 大幅增加角落策略权重
        
        // 3. 评估单调性（方块有序排列）- 动态权重
        const monotonicity = this.evaluateMonotonicity(grid);
        const monotonicityWeight = highestTile >= 512 ? 80 : 60;
        score += monotonicity * monotonicityWeight;
        
        // 4. 评估相邻方块的平滑性
        const smoothness = this.evaluateSmoothness(grid);
        score += smoothness * 50; // 增加平滑性权重
        
        // 5. 评估蛇形模式 - 更早触发和更高权重
        if (highestTile >= 128) {
            const snakeScore = this.evaluateSnakePattern(grid);
            const snakeWeight = highestTile >= 512 ? 1500 : 1200;
            score += snakeScore * snakeWeight;
        }
        
        // 6. 评估最大方块的值 - 指数增长奖励
        score += Math.log2(highestTile + 1) * highestTile * 0.5;
        
        // 7. 评估合并机会
        const mergeOpportunities = this.evaluateMergeOpportunities(grid);
        score += mergeOpportunities * 40;
        
        // 8. 新增：评估边缘位置策略
        const edgeStrategy = this.evaluateEdgeStrategy(grid);
        score += edgeStrategy * 30;
        
        // 9. 新增：评估高值方块聚集度
        const clustering = this.evaluateHighValueClustering(grid);
        score += clustering * 80;
        
        // 10. 新增：惩罚散布的高值方块
        const scatterPenalty = this.evaluateScatterPenalty(grid);
        score -= scatterPenalty * 60;
        
        // 11. 新增：评估潜在合并价值
        const potentialMerges = this.evaluatePotentialMerges(grid);
        score += potentialMerges * 25;
        
        // 12. 新增：动态深度奖励（鼓励形成更深的序列）
        const depthBonus = this.evaluateDepthBonus(grid);
        score += depthBonus * 20;
        
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
        // 增强的角落策略评估
        const corners = [
            {x: 0, y: 0}, 
            {x: 0, y: 3},
            {x: 3, y: 0},
            {x: 3, y: 3}
        ];
        
        let cornerScore = 0;
        const maxTile = this.getHighestTile(grid);
        const secondMaxTile = this.getSecondHighestTile(grid);
        
        // 为每个角落评分
        for (const corner of corners) {
            const cornerValue = grid[corner.x][corner.y];
            
            // 最大方块在角落得分最高
            if (cornerValue === maxTile) {
                cornerScore += 2.0;
                
                // 检查该角落是否有良好的支撑结构
                const supportScore = this.evaluateCornerSupport(grid, corner, maxTile);
                cornerScore += supportScore;
            } 
            // 次大方块在角落也有较高得分
            else if (cornerValue === secondMaxTile) {
                cornerScore += 1.2;
            }
            // 较大方块（超过最大值的1/4）在角落也加分
            else if (cornerValue > maxTile / 4 && cornerValue > 0) {
                cornerScore += 0.6;
            }
            
            // 空角落略微减分（应该被利用）
            if (cornerValue === 0) {
                cornerScore -= 0.1;
            }
        }
        
        // 检查是否有多个角落同时被大数字占据（通常不利）
        let occupiedCorners = 0;
        for (const corner of corners) {
            if (grid[corner.x][corner.y] >= maxTile / 2) {
                occupiedCorners++;
            }
        }
        
        // 超过一个角落被大数字占据时，略微减分
        if (occupiedCorners > 1) {
            cornerScore -= (occupiedCorners - 1) * 0.3;
        }
        
        return cornerScore;
    }
    
    // 新增：获取第二大数字
    getSecondHighestTile(grid) {
        let highest = 0;
        let secondHighest = 0;
        
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (grid[x][y] > highest) {
                    secondHighest = highest;
                    highest = grid[x][y];
                } else if (grid[x][y] > secondHighest && grid[x][y] < highest) {
                    secondHighest = grid[x][y];
                }
            }
        }
        
        return secondHighest;
    }
    
    // 新增：评估角落支撑结构
    evaluateCornerSupport(grid, corner, maxTile) {
        let supportScore = 0;
        
        // 检查角落周围的支撑方块
        const adjacentPositions = [
            {x: corner.x + (corner.x === 0 ? 1 : -1), y: corner.y},
            {x: corner.x, y: corner.y + (corner.y === 0 ? 1 : -1)}
        ];
        
        for (const pos of adjacentPositions) {
            if (pos.x >= 0 && pos.x < 4 && pos.y >= 0 && pos.y < 4) {
                const adjValue = grid[pos.x][pos.y];
                
                // 邻接位置有较大数字时加分
                if (adjValue >= maxTile / 2) {
                    supportScore += 0.5;
                } else if (adjValue >= maxTile / 4) {
                    supportScore += 0.3;
                }
                
                // 检查是否形成递减序列
                if (adjValue > 0 && adjValue <= maxTile) {
                    const ratio = maxTile / adjValue;
                    if (ratio === 2) {
                        supportScore += 0.4; // 形成2倍关系时额外加分
                    } else if (ratio === 4) {
                        supportScore += 0.2; // 形成4倍关系时适度加分
                    }
                }
            }
        }
        
        return supportScore;
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
    
    // 新增：评估边缘位置策略
    evaluateEdgeStrategy(grid) {
        let edgeScore = 0;
        const maxTile = this.getHighestTile(grid);
        
        // 检查边缘位置（非角落）的大数字分布
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                const value = grid[x][y];
                if (value >= maxTile / 4) { // 关注较大的数字
                    // 边缘位置加分
                    if (x === 0 || x === 3 || y === 0 || y === 3) {
                        edgeScore += Math.log2(value + 1);
                    }
                    // 中心位置减分
                    if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
                        edgeScore -= Math.log2(value + 1) * 0.5;
                    }
                }
            }
        }
        
        return edgeScore;
    }
    
    // 新增：评估高值方块聚集度
    evaluateHighValueClustering(grid) {
        let clusterScore = 0;
        const maxTile = this.getHighestTile(grid);
        const threshold = Math.max(32, maxTile / 8); // 动态阈值
        
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (grid[x][y] >= threshold) {
                    // 检查周围的高值方块
                    let neighbors = 0;
                    let neighborSum = 0;
                    
                    const directions = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
                    
                    for (const dir of directions) {
                        const nx = x + dir.x;
                        const ny = y + dir.y;
                        
                        if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4) {
                            if (grid[nx][ny] >= threshold) {
                                neighbors++;
                                neighborSum += Math.log2(grid[nx][ny] + 1);
                            }
                        }
                    }
                    
                    // 高值方块周围有其他高值方块时加分
                    if (neighbors > 0) {
                        clusterScore += neighbors * Math.log2(grid[x][y] + 1) + neighborSum * 0.3;
                    }
                }
            }
        }
        
        return clusterScore;
    }
    
    // 新增：评估散布惩罚
    evaluateScatterPenalty(grid) {
        let scatterPenalty = 0;
        const maxTile = this.getHighestTile(grid);
        const highValueThreshold = Math.max(64, maxTile / 4);
        
        // 找出所有高值方块的位置
        const highValuePositions = [];
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (grid[x][y] >= highValueThreshold) {
                    highValuePositions.push({x, y, value: grid[x][y]});
                }
            }
        }
        
        // 计算高值方块之间的距离，距离越远惩罚越大
        for (let i = 0; i < highValuePositions.length; i++) {
            for (let j = i + 1; j < highValuePositions.length; j++) {
                const pos1 = highValuePositions[i];
                const pos2 = highValuePositions[j];
                const distance = Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
                
                // 同等级的方块距离远时惩罚更重
                if (pos1.value === pos2.value && distance > 2) {
                    scatterPenalty += Math.log2(pos1.value + 1) * distance;
                }
            }
        }
        
        return scatterPenalty;
    }
    
    // 新增：评估潜在合并价值
    evaluatePotentialMerges(grid) {
        let potentialScore = 0;
        
        // 检查不直接相邻但可能通过移动合并的方块
        for (let direction = 0; direction < 4; direction++) {
            const simResult = this.game.simulateMove(grid, direction);
            if (simResult.moved) {
                // 模拟移动后再检查直接合并机会
                const directMerges = this.evaluateMergeOpportunities(simResult.grid);
                potentialScore += directMerges * 0.7; // 给潜在合并较低权重
            }
        }
        
        // 检查形成连续序列的潜力
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                if (grid[x][y] > 0 && grid[x][y+1] > 0) {
                    // 检查是否可能形成2的幂次序列
                    const ratio = Math.max(grid[x][y], grid[x][y+1]) / Math.min(grid[x][y], grid[x][y+1]);
                    if (ratio === 2) {
                        potentialScore += Math.log2(Math.min(grid[x][y], grid[x][y+1]) + 1);
                    }
                }
            }
        }
        
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 3; x++) {
                if (grid[x][y] > 0 && grid[x+1][y] > 0) {
                    const ratio = Math.max(grid[x][y], grid[x+1][y]) / Math.min(grid[x][y], grid[x+1][y]);
                    if (ratio === 2) {
                        potentialScore += Math.log2(Math.min(grid[x][y], grid[x+1][y]) + 1);
                    }
                }
            }
        }
        
        return potentialScore;
    }
    
    // 新增：评估深度奖励
    evaluateDepthBonus(grid) {
        let depthBonus = 0;
        
        // 检查每行和每列的最长递减序列
        for (let i = 0; i < 4; i++) {
            // 检查行
            let rowSequence = 0;
            let maxRowSequence = 0;
            for (let j = 0; j < 3; j++) {
                if (grid[i][j] > 0 && grid[i][j+1] > 0 && grid[i][j] >= grid[i][j+1]) {
                    rowSequence++;
                    maxRowSequence = Math.max(maxRowSequence, rowSequence);
                } else {
                    rowSequence = 0;
                }
            }
            depthBonus += maxRowSequence * maxRowSequence; // 序列长度的平方奖励
            
            // 检查列
            let colSequence = 0;
            let maxColSequence = 0;
            for (let j = 0; j < 3; j++) {
                if (grid[j][i] > 0 && grid[j+1][i] > 0 && grid[j][i] >= grid[j+1][i]) {
                    colSequence++;
                    maxColSequence = Math.max(maxColSequence, colSequence);
                } else {
                    colSequence = 0;
                }
            }
            depthBonus += maxColSequence * maxColSequence;
        }
        
        return depthBonus;
    }
}
