/**
 * 2048游戏网格类
 * 负责处理游戏网格的创建、操作和状态管理
 */
export class Grid {
    constructor(size = 4) {
        this.size = size;
        this.cells = this.createEmptyGrid();
    }

    /**
     * 创建空网格
     */
    createEmptyGrid() {
        const grid = [];
        for (let x = 0; x < this.size; x++) {
            grid[x] = [];
            for (let y = 0; y < this.size; y++) {
                grid[x][y] = 0;
            }
        }
        return grid;
    }

    /**
     * 克隆网格
     */
    clone() {
        return JSON.parse(JSON.stringify(this.cells));
    }

    /**
     * 检查两个网格是否相同
     */
    equals(otherGrid) {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.cells[x][y] !== otherGrid[x][y]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 获取空位置
     */
    getAvailablePositions() {
        const positions = [];
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.cells[x][y] === 0) {
                    positions.push({x, y});
                }
            }
        }
        return positions;
    }

    /**
     * 检查网格是否已满
     */
    isFull() {
        return this.getAvailablePositions().length === 0;
    }

    /**
     * 在随机空位置添加新方块
     */
    insertTileAtRandomEmptyPosition() {
        const emptyPositions = this.getAvailablePositions();
        if (emptyPositions.length > 0) {
            const randomPosition = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
            this.cells[randomPosition.x][randomPosition.y] = Math.random() < 0.9 ? 2 : 4;
            return true;
        }
        return false;
    }

    /**
     * 获取最大值
     */
    getMaxValue() {
        let max = 0;
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                max = Math.max(max, this.cells[x][y]);
            }
        }
        return max;
    }
}