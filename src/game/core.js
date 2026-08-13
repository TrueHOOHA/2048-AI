import { Grid } from './grid.js';

/**
 * 2048游戏核心类
 * 负责处理游戏逻辑、移动操作和游戏状态管理
 */
export class GameCore {
    constructor(size = 4) {
        this.size = size;
        this.grid = new Grid(size);
        this.score = 0;
        this.over = false;
        this.won = false;
        this.bestScore = parseInt(localStorage.getItem('bestScore') || '0');
    }

    /**
     * 重置游戏
     */
    reset() {
        this.grid = new Grid(this.size);
        this.score = 0;
        this.over = false;
        this.won = false;
        
        // 添加初始瓦片
        this.grid.insertTileAtRandomEmptyPosition();
        this.grid.insertTileAtRandomEmptyPosition();
    }

    /**
     * 滑动一行/列
     */
    slideLine(line) {
        // 过滤零值
        const filteredLine = line.filter(tile => tile !== 0);
        
        // 合并相同值
        for (let i = 0; i < filteredLine.length - 1; i++) {
            if (filteredLine[i] === filteredLine[i + 1]) {
                filteredLine[i] *= 2;
                filteredLine[i + 1] = 0;
                this.score += filteredLine[i];
                
                // 检查是否达到2048
                if (filteredLine[i] === 2048) {
                    this.won = true;
                }
            }
        }
        
        // 过滤零值并补零
        const result = filteredLine.filter(tile => tile !== 0);
        while (result.length < this.size) {
            result.push(0);
        }
        
        return result;
    }

    /**
     * 移动操作
     * direction: 0-上, 1-右, 2-下, 3-左
     */
    move(direction) {
        if (this.over || this.won) return false;
        
        const previousGrid = this.grid.clone();
        let moved = false;
        
        if (direction === 0) { // 上
            for (let x = 0; x < this.size; x++) {
                const column = [];
                for (let y = 0; y < this.size; y++) {
                    column.push(this.grid.cells[x][y]);
                }
                const result = this.slideLine(column);
                for (let y = 0; y < this.size; y++) {
                    this.grid.cells[x][y] = result[y];
                    if (!moved && result[y] !== column[y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 1) { // 右
            for (let y = 0; y < this.size; y++) {
                const row = [];
                for (let x = this.size - 1; x >= 0; x--) {
                    row.push(this.grid.cells[x][y]);
                }
                const result = this.slideLine(row);
                for (let x = this.size - 1; x >= 0; x--) {
                    this.grid.cells[x][y] = result[this.size - 1 - x];
                    if (!moved && result[this.size - 1 - x] !== row[this.size - 1 - x]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 2) { // 下
            for (let x = 0; x < this.size; x++) {
                const column = [];
                for (let y = this.size - 1; y >= 0; y--) {
                    column.push(this.grid.cells[x][y]);
                }
                const result = this.slideLine(column);
                for (let y = this.size - 1; y >= 0; y--) {
                    this.grid.cells[x][y] = result[this.size - 1 - y];
                    if (!moved && result[this.size - 1 - y] !== column[this.size - 1 - y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 3) { // 左
            for (let y = 0; y < this.size; y++) {
                const row = [];
                for (let x = 0; x < this.size; x++) {
                    row.push(this.grid.cells[x][y]);
                }
                const result = this.slideLine(row);
                for (let x = 0; x < this.size; x++) {
                    this.grid.cells[x][y] = result[x];
                    if (!moved && result[x] !== row[x]) {
                        moved = true;
                    }
                }
            }
        }
        
        if (moved) {
            this.grid.insertTileAtRandomEmptyPosition();
            this.updateBestScore();
        }
        
        return moved;
    }

    /**
     * 更新最佳分数
     */
    updateBestScore() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bestScore', this.bestScore);
        }
    }

    /**
     * 检查是否有可用移动
     */
    hasAvailableMoves() {
        if (!this.grid.isFull()) return true;
        
        // 检查横向
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size - 1; x++) {
                if (this.grid.cells[x][y] === this.grid.cells[x + 1][y]) {
                    return true;
                }
            }
        }
        
        // 检查纵向
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size - 1; y++) {
                if (this.grid.cells[x][y] === this.grid.cells[x][y + 1]) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 检查游戏状态
     */
    checkGameStatus() {
        if (this.won) {
            return 'won';
        } else if (!this.hasAvailableMoves()) {
            this.over = true;
            return 'over';
        }
        return 'playing';
    }

    /**
     * 获取当前网格状态
     */
    getGrid() {
        return this.grid.clone();
    }

    /**
     * 获取当前分数
     */
    getScore() {
        return this.score;
    }

    /**
     * 获取最佳分数
     */
    getBestScore() {
        return this.bestScore;
    }

    /**
     * 检查游戏是否结束
     */
    isGameOver() {
        return this.over || this.won;
    }

    /**
     * 模拟移动（用于AI）
     */
    simulateMove(grid, direction) {
        const newGrid = JSON.parse(JSON.stringify(grid));
        let moved = false;
        let scoreDelta = 0;
        
        const slideLine = (line) => {
            const filteredLine = line.filter(tile => tile !== 0);
            const result = [];
            
            for (let i = 0; i < filteredLine.length; i++) {
                if (i < filteredLine.length - 1 && filteredLine[i] === filteredLine[i + 1]) {
                    result.push(filteredLine[i] * 2);
                    scoreDelta += filteredLine[i] * 2;
                    i++; // 跳过下一个元素
                } else {
                    result.push(filteredLine[i]);
                }
            }
            
            while (result.length < this.size) {
                result.push(0);
            }
            
            return result;
        };
        
        if (direction === 0) { // 上
            for (let x = 0; x < this.size; x++) {
                const column = [];
                for (let y = 0; y < this.size; y++) {
                    column.push(newGrid[x][y]);
                }
                const result = slideLine(column);
                for (let y = 0; y < this.size; y++) {
                    newGrid[x][y] = result[y];
                    if (!moved && result[y] !== column[y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 1) { // 右
            for (let y = 0; y < this.size; y++) {
                const row = [];
                for (let x = this.size - 1; x >= 0; x--) {
                    row.push(newGrid[x][y]);
                }
                const result = slideLine(row);
                for (let x = this.size - 1; x >= 0; x--) {
                    newGrid[x][y] = result[this.size - 1 - x];
                    if (!moved && result[this.size - 1 - x] !== row[this.size - 1 - x]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 2) { // 下
            for (let x = 0; x < this.size; x++) {
                const column = [];
                for (let y = this.size - 1; y >= 0; y--) {
                    column.push(newGrid[x][y]);
                }
                const result = slideLine(column);
                for (let y = this.size - 1; y >= 0; y--) {
                    newGrid[x][y] = result[this.size - 1 - y];
                    if (!moved && result[this.size - 1 - y] !== column[this.size - 1 - y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 3) { // 左
            for (let y = 0; y < this.size; y++) {
                const row = [];
                for (let x = 0; x < this.size; x++) {
                    row.push(newGrid[x][y]);
                }
                const result = slideLine(row);
                for (let x = 0; x < this.size; x++) {
                    newGrid[x][y] = result[x];
                    if (!moved && result[x] !== row[x]) {
                        moved = true;
                    }
                }
            }
        }
        
        return {
            grid: newGrid,
            moved: moved,
            scoreDelta: scoreDelta
        };
    }
}