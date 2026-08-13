/**
 * 2048游戏渲染器
 * 通过直接操作 transform 内联样式驱动动画，避免 class 切换问题
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
     * 计算某格子在 tile-container 内的像素偏移
     * 桌面：gap=15px, cell=82.5px → step=97.5
     * 移动端（max-width:520px）：gap=10px, cell=57.5px → step=67.5
     */
    _pos(x, y) {
        const isMobile = window.innerWidth <= 520;
        const step = isMobile ? 67.5 : 97.5;
        return { px: x * step, py: y * step };
    }

    /**
     * 渲染游戏网格
     * @param {number[][]} prev - 移动前的网格快照（null 表示首次渲染）
     */
    render(prev = null) {
        const { moves, spawns, merges, removes } = this.computeDiff(prev);
        // 先处理移除（淡出）
        removes.forEach(r => this.removeTile(r));
        // 再处理移动、合并、新建（在 remove 之后，避免冲突）
        moves.forEach(m => this.moveTile(m));
        spawns.forEach(s => this.spawnTile(s));
        merges.forEach(m => this.mergeTile(m));
        this.updateScore();
    }

    /**
     * 计算 diff：moves / spawns / merges / removes
     */
    computeDiff(prev) {
        const moves = [];
        const spawns = [];
        const merges = [];
        const removes = [];

        if (!prev) {
            // 首次渲染：全部 spawn
            for (let x = 0; x < this.game.size; x++) {
                for (let y = 0; y < this.game.size; y++) {
                    const v = this.game.grid.cells[x][y];
                    if (v !== 0) spawns.push({ value: v, x, y });
                }
            }
            return { moves, spawns, merges, removes };
        }

        // 收集当前和 prev 的非零瓦片
        const curTiles = [];   // {x, y, val}
        const prevTiles = [];  // {x, y, val}
        const curKeySet = new Set();
        const prevKeySet = new Set();

        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const cv = this.game.grid.cells[x][y];
                const pv = prev[x][y];
                if (cv !== 0) curTiles.push({ x, y, val: cv });
                if (pv !== 0) prevTiles.push({ x, y, val: pv });
                if (cv !== 0) curKeySet.add(`${x},${y}`);
                if (pv !== 0) prevKeySet.add(`${x},${y}`);
            }
        }

        // 检测合并：同一位置 cur 值 > prev 值
        const mergeKeys = new Set();
        for (const ct of curTiles) {
            const pk = `${ct.x},${ct.y}`;
            if (prevKeySet.has(pk) && ct.val > prev[ct.x][ct.y]) {
                mergeKeys.add(pk);
            }
        }

        // 检测移除：prev 有、cur 没有、且不是合并目标
        for (const pt of prevTiles) {
            const key = `${pt.x},${pt.y}`;
            if (!mergeKeys.has(key) && !curKeySet.has(key)) {
                removes.push({ x: pt.x, y: pt.y, key });
            }
        }

        // 处理每个 cur 瓦片
        const processedCurKeys = new Set();
        for (const ct of curTiles) {
            const ckey = `${ct.x},${ct.y}`;
            if (mergeKeys.has(ckey)) {
                merges.push({ value: ct.val, x: ct.x, y: ct.y });
                processedCurKeys.add(ckey);
                continue;
            }
            if (prevKeySet.has(ckey) && prev[ct.x][ct.y] === ct.val) {
                // 值不变，跳过
                processedCurKeys.add(ckey);
                continue;
            }

            // 在 prev 中找同值瓦片作为移动源
            let moved = false;
            for (const pt of prevTiles) {
                const pkey = `${pt.x},${pt.y}`;
                if (processedCurKeys.has(pkey)) continue;
                if (pt.val === ct.val) {
                    // 找到候选，创建移动记录
                    const srcEl = this.tileContainer?.querySelector(`.tile[data-key="${pkey}"]`);
                    if (srcEl) {
                        moves.push({ fromX: pt.x, fromY: pt.y, x: ct.x, y: ct.y, value: ct.val, el: srcEl });
                        processedCurKeys.add(pkey);
                        moved = true;
                        break;
                    }
                }
            }

            if (!moved) {
                // 没有找到可移动的源瓦片 → 新建
                spawns.push({ value: ct.val, x: ct.x, y: ct.y });
            }
            processedCurKeys.add(ckey);
        }

        return { moves, spawns, merges, removes };
    }

    /**
     * 移动瓦片：先瞬移到目标格，强制 reflow，再动画回到原位
     * 这样视觉效果是瓦片从源滑到目标
     */
    moveTile(m) {
        if (!this.tileContainer || !m.el) {
            // 找不到源元素，当作新建
            this.spawnTile({ value: m.value, x: m.x, y: m.y });
            return;
        }

        const el = m.el;
        const dest = this._pos(m.x, m.y);

        // 1. 移除 transition，将瓦片瞬移到目标位置
        el.style.transition = 'none';
        el.style.transform = `translate(${dest.px}px, ${dest.py}px)`;

        // 2. 强制 reflow，让浏览器应用瞬移
        void el.offsetWidth;

        // 3. 恢复 transition，将瓦片动画回原位 (0,0)
        // 由于瓦片已经在目标格的中心，translate(0,0) 就是停在目标格
        el.style.transition = 'transform 0.15s ease-in-out';
        el.style.transform = 'translate(0, 0)';

        el.dataset.key = `${m.x},${m.y}`;
        el.dataset.pos = `${m.x},${m.y}`;
    }

    /**
     * 新建瓦片：从缩放 0 动画到正常大小，出现在指定格子
     */
    spawnTile(s) {
        if (!this.tileContainer) return;
        const pos = this._pos(s.x, s.y);

        const tile = document.createElement('div');
        tile.className = 'tile tile-new tile-spawning';
        tile.dataset.key = `${s.x},${s.y}`;
        tile.dataset.pos = `${s.x},${s.y}`;
        tile.textContent = s.value;

        // 初始状态：scale(0) + 位于目标格
        tile.style.transform = 'translate(' + pos.px + 'px, ' + pos.py + 'px) scale(0)';
        tile.style.opacity = '0';

        this.tileContainer.appendChild(tile);

        // 下一帧：触发 scale-in 动画
        requestAnimationFrame(() => {
            tile.classList.remove('tile-spawning');
        });

        setTimeout(() => tile.classList.remove('tile-new'), 300);
    }

    /**
     * 合并瓦片：在目标格弹跳出现
     */
    mergeTile(m) {
        if (!this.tileContainer) return;
        const pos = this._pos(m.x, m.y);

        const tile = document.createElement('div');
        tile.className = 'tile tile-merged';
        tile.dataset.key = `${m.x},${m.y}`;
        tile.dataset.pos = `${m.x},${m.y}`;
        tile.textContent = m.value;

        tile.style.transform = `translate(${pos.px}px, ${pos.py}px)`;
        this.tileContainer.appendChild(tile);

        setTimeout(() => tile.classList.remove('tile-merged'), 200);
    }

    /**
     * 移除瓦片：淡出后删除 DOM
     */
    removeTile(r) {
        if (!this.tileContainer) return;
        const el = this.tileContainer.querySelector(`.tile[data-key="${r.key}"]`);
        if (el) {
            el.style.transition = 'opacity 0.12s';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 130);
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
