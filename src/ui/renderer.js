/**
 * 2048游戏渲染器
 * 使用纯 CSS transition 驱动所有动画，避免 @keyframes 与 transition 冲突
 */
export class Renderer {
    constructor(game) {
        this.game = game;
        this.tileContainer = document.querySelector('.tile-container');
        this.scoreContainer = document.getElementById('score');
        this.bestScoreContainer = document.getElementById('best-score');
        this.messageContainer = document.querySelector('.game-message');
    }

    _pos(x, y) {
        const isMobile = window.innerWidth <= 520;
        const step = isMobile ? 67.5 : 97.5;
        return { px: x * step, py: y * step };
    }

    render(prev = null) {
        const { moves, spawns, merges, removes } = this.computeDiff(prev);
        removes.forEach(r => this.removeTile(r));
        moves.forEach(m => this.moveTile(m));
        spawns.forEach(s => this.spawnTile(s));
        merges.forEach(m => this.mergeTile(m));
        this.updateScore();
    }

    computeDiff(prev) {
        const moves = [];
        const spawns = [];
        const merges = [];
        const removes = [];

        if (!prev) {
            for (let x = 0; x < this.game.size; x++) {
                for (let y = 0; y < this.game.size; y++) {
                    const v = this.game.grid.cells[x][y];
                    if (v !== 0) spawns.push({ value: v, x, y });
                }
            }
            return { moves, spawns, merges, removes };
        }

        const curTiles = [];
        const prevTiles = [];
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

        const mergeKeys = new Set();
        for (const ct of curTiles) {
            const pk = `${ct.x},${ct.y}`;
            if (prevKeySet.has(pk) && ct.val > prev[ct.x][ct.y]) {
                mergeKeys.add(pk);
            }
        }

        for (const pt of prevTiles) {
            const key = `${pt.x},${pt.y}`;
            if (!mergeKeys.has(key) && !curKeySet.has(key)) {
                removes.push({ x: pt.x, y: pt.y, key });
            }
        }

        const processedCurKeys = new Set();
        for (const ct of curTiles) {
            const ckey = `${ct.x},${ct.y}`;
            if (mergeKeys.has(ckey)) {
                merges.push({ value: ct.val, x: ct.x, y: ct.y });
                processedCurKeys.add(ckey);
                continue;
            }
            if (prevKeySet.has(ckey) && prev[ct.x][ct.y] === ct.val) {
                processedCurKeys.add(ckey);
                continue;
            }

            let moved = false;
            for (const pt of prevTiles) {
                const pkey = `${pt.x},${pt.y}`;
                if (processedCurKeys.has(pkey)) continue;
                if (pt.val === ct.val) {
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
                spawns.push({ value: ct.val, x: ct.x, y: ct.y });
            }
            processedCurKeys.add(ckey);
        }

        return { moves, spawns, merges, removes };
    }

    moveTile(m) {
        if (!this.tileContainer || !m.el) {
            this.spawnTile({ value: m.value, x: m.x, y: m.y });
            return;
        }

        const el = m.el;
        const src = this._pos(m.fromX, m.fromY);
        const dest = this._pos(m.x, m.y);

        el.style.transition = 'none';
        el.style.transform = `translate(${src.px}px, ${src.py}px)`;
        void el.offsetWidth;

        el.style.transition = 'transform 0.15s ease-in-out';
        el.style.transform = `translate(${dest.px}px, ${dest.py}px)`;

        el.dataset.key = `${m.x},${m.y}`;
        el.dataset.pos = `${m.x},${m.y}`;
    }

    spawnTile(s) {
        if (!this.tileContainer) return;
        const pos = this._pos(s.x, s.y);

        const tile = document.createElement('div');
        tile.className = `tile tile-${s.value}`;
        tile.dataset.key = `${s.x},${s.y}`;
        tile.dataset.pos = `${s.x},${s.y}`;
        tile.textContent = s.value;

        tile.style.transition = 'none';
        tile.style.transform = `translate(${pos.px}px, ${pos.py}px) scale(0)`;
        tile.style.opacity = '0';
        this.tileContainer.appendChild(tile);

        void tile.offsetWidth;

        tile.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
        tile.style.transform = `translate(${pos.px}px, ${pos.py}px) scale(1)`;
        tile.style.opacity = '1';

        setTimeout(() => {
            tile.style.transition = '';
        }, 200);
    }

    mergeTile(m) {
        if (!this.tileContainer) return;
        const pos = this._pos(m.x, m.y);

        const tile = document.createElement('div');
        tile.className = `tile tile-${m.value}`;
        tile.dataset.key = `${m.x},${m.y}`;
        tile.dataset.pos = `${m.x},${m.y}`;
        tile.textContent = m.value;

        tile.style.transform = `translate(${pos.px}px, ${pos.py}px)`;
        this.tileContainer.appendChild(tile);

        void tile.offsetWidth;

        tile.style.transition = 'transform 0.1s ease-out';
        tile.style.transform = `translate(${pos.px}px, ${pos.py}px) scale(1.2)`;

        setTimeout(() => {
            tile.style.transition = 'transform 0.1s ease-out';
            tile.style.transform = `translate(${pos.px}px, ${pos.py}px) scale(1)`;
            setTimeout(() => {
                tile.style.transition = '';
            }, 100);
        }, 100);
    }

    removeTile(r) {
        if (!this.tileContainer) return;
        const el = this.tileContainer.querySelector(`.tile[data-key="${r.key}"]`);
        if (el) {
            el.style.transition = 'opacity 0.12s';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 130);
        }
    }

    updateScore() {
        if (this.scoreContainer) {
            this.scoreContainer.textContent = this.game.getScore();
        }
        if (this.bestScoreContainer) {
            this.bestScoreContainer.textContent = this.game.getBestScore();
        }
    }

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

    hideMessage() {
        if (this.messageContainer) {
            this.messageContainer.style.display = 'none';
        }
    }
}