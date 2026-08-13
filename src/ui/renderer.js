/**
 * 2048游戏渲染器
 * 负责游戏界面渲染和动画
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
     * @param {number[][]} prev - 移动前的网格快照（null 表示首次渲染）
     */
    render(prev = null) {
        const { moves, spawns, removes } = this.diffGrid(prev);
        moves.forEach(m => this.animateMove(m));
        spawns.forEach(s => this.animateSpawn(s));
        removes.forEach(r => this.removeTile(r));
        this.updateScore();
    }

    /**
     * Diff 前后两次网格，检测移动/合并/新生成/移除
     */
    diffGrid(prev) {
        const moves = [];
        const spawns = [];
        const removes = [];

        if (!prev) {
            // 首次渲染，所有瓦片视为新生成
            for (let x = 0; x < this.game.size; x++) {
                for (let y = 0; y < this.game.size; y++) {
                    if (this.game.grid.cells[x][y] !== 0) {
                        spawns.push({ value: this.game.grid.cells[x][y], x, y });
                    }
                }
            }
            return { moves, spawns, removes };
        }

        // 记录 prev 中各位置的值
        const prevMap = new Map();
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (prev[x][y] !== 0) prevMap.set(`${x},${y}`, prev[x][y]);
            }
        }

        // 记录 prev 中所有键，用于检测移除
        const prevKeys = new Set(prevMap.keys());
        const curKeys = new Set();

        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const val = this.game.grid.cells[x][y];
                if (val === 0) continue;
                const key = `${x},${y}`;
                curKeys.add(key);

                if (prevMap.has(key)) {
                    const prevVal = prevMap.get(key);
                    if (val === prevVal) {
                        // 值未变，无需动画
                    } else if (val > prevVal) {
                        // 合并：新瓦片在目标格弹出
                        spawns.push({ value: val, x, y, merged: true });
                    }
                } else {
                    // 新出现的位置：移动或新生成
                    spawns.push({ value: val, x, y, merged: false });
                }
            }
        }

        // 计算被移除的瓦片（prev 有但 cur 没有，且不是合并产生的目标格）
        const mergeKeys = new Set(spawns.filter(s => s.merged).map(s => `${s.x},${s.y}`));
        for (const key of prevKeys) {
            if (!curKeys.has(key) && !mergeKeys.has(key)) {
                const [x, y] = key.split(',').map(Number);
                removes.push({ x, y, key });
            }
        }

        return { moves, spawns, removes };
    }

    /**
     * 移动动画：复用 DOM 元素，通过 CSS transition 滑动
     */
    animateMove(m) {
        if (!this.tileContainer) return;
        const el = this.tileContainer.querySelector(`.tile[data-key="${m.fromKey}"]`);
        if (!el) {
            // 找不到源元素，当作新生成处理
            this.animateSpawn(m);
            return;
        }

        el.classList.remove(`tile-position-${m.fromX + 1}-${m.fromY + 1}`);
        el.classList.add(`tile-position-${m.x + 1}-${m.y + 1}`);
        el.dataset.key = `${m.x},${m.y}`;

        el.addEventListener('transitionend', () => {
            el.classList.remove('tile-moving');
        }, { once: true });
    }

    /**
     * 新生成/合并动画：创建 DOM 元素并播放缩放效果
     */
    animateSpawn(s) {
        if (!this.tileContainer) return;

        const tile = document.createElement('div');
        tile.className = `tile tile-${s.value}${s.merged ? ' tile-merged' : ' tile-new'}`;
        tile.dataset.key = `${s.x},${s.y}`;
        tile.textContent = s.value;
        tile.classList.add(`tile-position-${s.x + 1}-${s.y + 1}`);
        this.tileContainer.appendChild(tile);

        if (s.merged) {
            setTimeout(() => tile.classList.remove('tile-merged'), 200);
        }
    }

    /**
     * 移除动画：将消失的瓦片淡出
     */
    removeTile(r) {
        if (!this.tileContainer) return;
        const el = this.tileContainer.querySelector(`.tile[data-key="${r.key}"]`);
        if (el) {
            el.style.transition = 'opacity 0.15s';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 160);
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