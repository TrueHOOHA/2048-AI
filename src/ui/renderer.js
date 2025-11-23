/**
 * 2048游戏渲染器
 * 负责游戏界面的渲染和更新
 */
export class Renderer {
    constructor(game) {
        this.game = game;
        this.tileContainer = document.querySelector('.tile-container');
        this.scoreContainer = document.getElementById('score');
        this.bestScoreContainer = document.getElementById('best-score');
        this.messageContainer = document.querySelector('.game-message');
    }

    /**
     * 渲染游戏网格
     */
    render() {
        this.renderTiles();
        this.updateScore();
    }

    /**
     * 渲染瓦片
     */
    renderTiles() {
        if (!this.tileContainer) return;
        
        this.tileContainer.innerHTML = '';
        
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (this.game.grid.cells[x][y] !== 0) {
                    const tile = document.createElement('div');
                    const value = this.game.grid.cells[x][y];
                    tile.className = `tile tile-${value} tile-position-${x+1}-${y+1}`;
                    tile.textContent = value;
                    this.tileContainer.appendChild(tile);
                }
            }
        }
    }

    /**
     * 更新分数显示
     */
    updateScore() {
        if (this.scoreContainer) {
            this.scoreContainer.textContent = this.game.getScore();
        }
        
        if (this.bestScoreContainer) {
            this.bestScoreContainer.textContent = this.game.getBestScore();
        }
    }

    /**
     * 显示游戏消息
     */
    showMessage(message, type = '') {
        if (this.messageContainer) {
            this.messageContainer.style.display = 'flex';
            this.messageContainer.classList.remove('game-won', 'game-over');
            
            if (type) {
                this.messageContainer.classList.add(type);
            }
            
            const pElement = this.messageContainer.querySelector('p');
            if (pElement) {
                pElement.textContent = message;
            }
        }
    }

    /**
     * 隐藏游戏消息
     */
    hideMessage() {
        if (this.messageContainer) {
            this.messageContainer.style.display = 'none';
        }
    }
}