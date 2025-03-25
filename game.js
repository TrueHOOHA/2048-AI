class Game {
    constructor() {
        this.size = 4;
        this.tileContainer = document.querySelector('.tile-container');
        this.scoreContainer = document.getElementById('score');
        this.bestScoreContainer = document.getElementById('best-score');
        this.messageContainer = document.querySelector('.game-message');
        
        this.setup();
        
        // 键盘事件监听
        this.bindKeyEvents();
        
        // 重新开始按钮
        document.querySelector('.retry-button').addEventListener('click', () => this.restart());
    }
    
    setup() {
        this.grid = [];
        this.score = 0;
        this.over = false;
        this.won = false;
        this.bestScore = localStorage.getItem('bestScore') || 0;
        this.bestScoreContainer.textContent = this.bestScore;
        
        // 初始化网格
        for (let x = 0; x < this.size; x++) {
            this.grid[x] = [];
            for (let y = 0; y < this.size; y++) {
                this.grid[x][y] = 0;
            }
        }
        
        // 清空瓦片容器
        this.tileContainer.innerHTML = '';
        
        // 隐藏消息
        this.messageContainer.style.display = 'none';
        
        // 添加初始瓦片
        this.addRandomTile();
        this.addRandomTile();
        
        this.updateScore();
    }
    
    restart() {
        this.setup();
    }
    
    bindKeyEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.over || this.won) return;
            
            let moved = false;
            
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    moved = this.move(0);
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    moved = this.move(1);
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    moved = this.move(2);
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    moved = this.move(3);
                    break;
            }
            
            if (moved) {
                this.addRandomTile();
                this.checkGameStatus();
            }
        });
    }
    
    // 方向: 0-上, 1-右, 2-下, 3-左
    move(direction) {
        let moved = false;
        const previousGrid = JSON.parse(JSON.stringify(this.grid)); // 克隆网格状态
        
        if (direction === 0) { // 上
            for (let x = 0; x < this.size; x++) {
                const column = [];
                for (let y = 0; y < this.size; y++) {
                    column.push(this.grid[x][y]);
                }
                const result = this.slideTiles(column);
                for (let y = 0; y < this.size; y++) {
                    this.grid[x][y] = result[y];
                    if (!moved && result[y] !== column[y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 1) { // 右
            for (let y = 0; y < this.size; y++) {
                const row = [];
                for (let x = this.size - 1; x >= 0; x--) {
                    row.push(this.grid[x][y]);
                }
                const result = this.slideTiles(row);
                for (let x = this.size - 1; x >= 0; x--) {
                    this.grid[x][y] = result[this.size - 1 - x];
                    if (!moved && result[this.size - 1 - x] !== row[this.size - 1 - x]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 2) { // 下
            for (let x = 0; x < this.size; x++) {
                const column = [];
                for (let y = this.size - 1; y >= 0; y--) {
                    column.push(this.grid[x][y]);
                }
                const result = this.slideTiles(column);
                for (let y = this.size - 1; y >= 0; y--) {
                    this.grid[x][y] = result[this.size - 1 - y];
                    if (!moved && result[this.size - 1 - y] !== column[this.size - 1 - y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 3) { // 左
            for (let y = 0; y < this.size; y++) {
                const row = [];
                for (let x = 0; x < this.size; x++) {
                    row.push(this.grid[x][y]);
                }
                const result = this.slideTiles(row);
                for (let x = 0; x < this.size; x++) {
                    this.grid[x][y] = result[x];
                    if (!moved && result[x] !== row[x]) {
                        moved = true;
                    }
                }
            }
        }
        
        if (moved) {
            this.renderGrid();
            this.updateScore();
        }
        
        return moved;
    }
    
    slideTiles(line) {
        const newLine = this.filterZero(line);
        
        for (let i = 0; i < newLine.length - 1; i++) {
            if (newLine[i] === newLine[i + 1]) {
                newLine[i] *= 2;
                newLine[i + 1] = 0;
                this.score += newLine[i];
                
                // 检查是否达到2048
                if (newLine[i] === 2048) {
                    this.won = true;
                }
            }
        }
        
        const filteredLine = this.filterZero(newLine);
        
        // 补齐零
        while (filteredLine.length < this.size) {
            filteredLine.push(0);
        }
        
        return filteredLine;
    }
    
    filterZero(line) {
        return line.filter(tile => tile !== 0);
    }
    
    addRandomTile() {
        if (this.isFull()) return;
        
        let emptySpots = [];
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.grid[x][y] === 0) {
                    emptySpots.push({x, y});
                }
            }
        }
        
        if (emptySpots.length > 0) {
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            this.grid[spot.x][spot.y] = Math.random() < 0.9 ? 2 : 4;
            this.renderGrid();
        }
    }
    
    renderGrid() {
        this.tileContainer.innerHTML = '';
        
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.grid[x][y] !== 0) {
                    const tile = document.createElement('div');
                    const value = this.grid[x][y];
                    tile.className = `tile tile-${value} tile-position-${x+1}-${y+1}`;
                    tile.textContent = value;
                    this.tileContainer.appendChild(tile);
                }
            }
        }
    }
    
    updateScore() {
        this.scoreContainer.textContent = this.score;
        
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.bestScoreContainer.textContent = this.bestScore;
            localStorage.setItem('bestScore', this.bestScore);
        }
    }
    
    isFull() {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.grid[x][y] === 0) {
                    return false;
                }
            }
        }
        return true;
    }
    
    hasAvailableMoves() {
        if (!this.isFull()) return true;
        
        // 横向检查
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size - 1; x++) {
                if (this.grid[x][y] === this.grid[x + 1][y]) {
                    return true;
                }
            }
        }
        
        // 纵向检查
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size - 1; y++) {
                if (this.grid[x][y] === this.grid[x][y + 1]) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    checkGameStatus() {
        if (this.won) {
            this.messageContainer.style.display = 'flex';
            this.messageContainer.classList.add('game-won');
            this.messageContainer.querySelector('p').textContent = '恭喜，你赢了！';
        } else if (!this.hasAvailableMoves()) {
            this.over = true;
            this.messageContainer.style.display = 'flex';
            this.messageContainer.classList.add('game-over');
            this.messageContainer.querySelector('p').textContent = '游戏结束！';
        }
    }
    
    // 为AI提供的方法
    getGrid() {
        return JSON.parse(JSON.stringify(this.grid));
    }
    
    getScore() {
        return this.score;
    }
    
    isGameOver() {
        return this.over || this.won;
    }
    
    // 为AI提供的模拟移动方法（不改变实际游戏状态）
    simulateMove(grid, direction) {
        const size = this.size;
        const newGrid = JSON.parse(JSON.stringify(grid));
        let moved = false;
        let score = 0;
        
        if (direction === 0) { // 上
            for (let x = 0; x < size; x++) {
                const column = [];
                for (let y = 0; y < size; y++) {
                    column.push(newGrid[x][y]);
                }
                const result = this.simulateSlideTiles(column);
                score += result.score;
                for (let y = 0; y < size; y++) {
                    newGrid[x][y] = result.line[y];
                    if (!moved && result.line[y] !== column[y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 1) { // 右
            for (let y = 0; y < size; y++) {
                const row = [];
                for (let x = size - 1; x >= 0; x--) {
                    row.push(newGrid[x][y]);
                }
                const result = this.simulateSlideTiles(row);
                score += result.score;
                for (let x = size - 1; x >= 0; x--) {
                    newGrid[x][y] = result.line[size - 1 - x];
                    if (!moved && result.line[size - 1 - x] !== row[size - 1 - x]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 2) { // 下
            for (let x = 0; x < size; x++) {
                const column = [];
                for (let y = size - 1; y >= 0; y--) {
                    column.push(newGrid[x][y]);
                }
                const result = this.simulateSlideTiles(column);
                score += result.score;
                for (let y = size - 1; y >= 0; y--) {
                    newGrid[x][y] = result.line[size - 1 - y];
                    if (!moved && result.line[size - 1 - y] !== column[size - 1 - y]) {
                        moved = true;
                    }
                }
            }
        } else if (direction === 3) { // 左
            for (let y = 0; y < size; y++) {
                const row = [];
                for (let x = 0; x < size; x++) {
                    row.push(newGrid[x][y]);
                }
                const result = this.simulateSlideTiles(row);
                score += result.score;
                for (let x = 0; x < size; x++) {
                    newGrid[x][y] = result.line[x];
                    if (!moved && result.line[x] !== row[x]) {
                        moved = true;
                    }
                }
            }
        }
        
        return {
            grid: newGrid,
            moved: moved,
            score: score
        };
    }
    
    simulateSlideTiles(line) {
        let score = 0;
        const newLine = this.filterZero(line);
        
        for (let i = 0; i < newLine.length - 1; i++) {
            if (newLine[i] === newLine[i + 1]) {
                newLine[i] *= 2;
                newLine[i + 1] = 0;
                score += newLine[i];
            }
        }
        
        const filteredLine = this.filterZero(newLine);
        
        // 补齐零
        while (filteredLine.length < this.size) {
            filteredLine.push(0);
        }
        
        return {
            line: filteredLine,
            score: score
        };
    }
    
    // 获取随机空位
    getAvailablePositions(grid) {
        const positions = [];
        
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (grid[x][y] === 0) {
                    positions.push({x, y});
                }
            }
        }
        
        return positions;
    }
}
