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

        // 收集 prev 和 cur 中所有非零瓦片
        const prevTiles = [];
        const curTiles  = [];
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (prev[x][y] !== 0) prevTiles.push({ x, y, val: prev[x][y] });
                if (this.game.grid.cells[x][y] !== 0) curTiles.push({ x, y, val: this.game.grid.cells[x][y] });
            }
        }

        // cur 位置集合 & prev 位置集合
        const curKeySet = new Set(curTiles.map(t => `${t.x},${t.y}`));
        const prevKeySet = new Set(prevTiles.map(t => `${t.x},${t.y}`));

        // 建立 prev 的位置索引 map: "x,y" -> tile object
        const prevMap = new Map();
        for (const t of prevTiles) prevMap.set(`${t.x},${t.y}`, t);

        // 合并标记：cur 中值比 prev 同位置大的位置
        const mergeKeys = new Set();
        for (const ct of curTiles) {
            const pk = `${ct.x},${ct.y}`;
            if (prevMap.has(pk) && ct.val > prevMap.get(pk).val) {
                mergeKeys.add(pk);
            }
        }

        // 分类处理每个 cur 瓦片
        for (const ct of curTiles) {
            const key = `${ct.x},${ct.y}`;

            if (mergeKeys.has(key)) {
                // 合并：目标格弹跳出现
                spawns.push({ value: ct.val, x: ct.x, y: ct.y, merged: true });
            } else if (prevMap.has(key) && prevMap.get(key).val === ct.val) {
                // 值相同、位置相同 → 无需动画
            } else if (prevMap.has(key) && prevMap.get(key).val !== ct.val) {
                // 值变了但不在 mergeKeys 里（理论上不应该发生）→ 当作 spawn
                spawns.push({ value: ct.val, x: ct.x, y: ct.y, merged: false });
            } else {
                // cur 有新位置，判断是 move 还是 spawn
                // 找 prev 中值相同且不在 mergeKeys 中的瓦片，作为候选源
                const candidates = prevTiles.filter(pt =>
                    pt.val === ct.val && !mergeKeys.has(`${pt.x},${pt.y}`)
                );

                if (candidates.length > 0) {
                    // 有候选源 → 移动动画（取最近的）
                    let best = candidates[0], bestDist = Infinity;
                    for (const c of candidates) {
                        const dist = Math.abs(c.x - ct.x) + Math.abs(c.y - ct.y);
                        if (dist < bestDist) { bestDist = dist; best = c; }
                    }
                    // 排除目标位置本身也是 prev 有但被合并的情况
                    if (bestDist > 0) {
                        moves.push({ fromKey: `${best.x},${best.y}`, fromX: best.x, fromY: best.y,
                                     x: ct.x, y: ct.y, value: ct.val });
                    } else {
                        spawns.push({ value: ct.val, x: ct.x, y: ct.y, merged: false });
                    }
                } else {
                    // 没有候选源 → 新生成
                    spawns.push({ value: ct.val, x: ct.x, y: ct.y, merged: false });
                }
            }
        }

        // 移除：prev 有但 cur 没有，且不是合并目标
        for (const pt of prevTiles) {
            const key = `${pt.x},${pt.y}`;
            if (!curKeySet.has(key) && !mergeKeys.has(key)) {
                removes.push({ x: pt.x, y: pt.y, key });
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