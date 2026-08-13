/**
 * 2048游戏渲染器
 * 使用方向感知的瓦片匹配，精确追踪每个瓦片的移动/合并/生成
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

    render(prev = null, direction = 0) {
        const { moves, spawns, merges, removes } = this.computeDiff(prev, direction);
        removes.forEach(r => this.removeTile(r));
        moves.forEach(m => this.moveTile(m));
        spawns.forEach(s => this.spawnTile(s));
        merges.forEach(m => this.mergeTile(m));
        this.updateScore();
    }

    computeDiff(prev, direction) {
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

        const size = this.game.size;
        const movedGrid = Array.from({ length: size }, () => new Array(size).fill(0));
        const consumedPrev = new Set();

        const buildLines = () => {
            const lines = [];
            if (direction === 0) {
                for (let x = 0; x < size; x++) {
                    const cells = [];
                    for (let y = 0; y < size; y++) cells.push({ x, y });
                    lines.push({ cells, axis: 'y' });
                }
            } else if (direction === 1) {
                for (let y = 0; y < size; y++) {
                    const cells = [];
                    for (let x = size - 1; x >= 0; x--) cells.push({ x, y });
                    lines.push({ cells, axis: 'x' });
                }
            } else if (direction === 2) {
                for (let x = 0; x < size; x++) {
                    const cells = [];
                    for (let y = size - 1; y >= 0; y--) cells.push({ x, y });
                    lines.push({ cells, axis: 'y' });
                }
            } else {
                for (let y = 0; y < size; y++) {
                    const cells = [];
                    for (let x = 0; x < size; x++) cells.push({ x, y });
                    lines.push({ cells, axis: 'x' });
                }
            }
            return lines;
        };

        for (const line of buildLines()) {
            const prevTiles = [];
            for (const c of line.cells) {
                if (prev[c.x][c.y] !== 0) prevTiles.push({ x: c.x, y: c.y, val: prev[c.x][c.y] });
            }
            if (prevTiles.length === 0) continue;

            const result = [];
            let i = 0;
            while (i < prevTiles.length) {
                const t = prevTiles[i];
                if (i + 1 < prevTiles.length && prevTiles[i + 1].val === t.val) {
                    result.push({ val: t.val * 2, srcs: [t, prevTiles[i + 1]] });
                    i += 2;
                } else {
                    result.push({ val: t.val, srcs: [t] });
                    i += 1;
                }
            }

            for (let j = 0; j < result.length; j++) {
                const r = result[j];
                const dest = line.cells[j];
                movedGrid[dest.x][dest.y] = r.val;

                for (const src of r.srcs) {
                    consumedPrev.add(`${src.x},${src.y}`);
                }

                if (r.srcs.length === 1) {
                    const src = r.srcs[0];
                    const srcKey = `${src.x},${src.y}`;
                    const destKey = `${dest.x},${dest.y}`;
                    if (srcKey !== destKey) {
                        moves.push({ fromX: src.x, fromY: src.y, x: dest.x, y: dest.y, value: r.val });
                    }
                } else {
                    for (const src of r.srcs) {
                        removes.push({ x: src.x, y: src.y, key: `${src.x},${src.y}` });
                    }
                    merges.push({ value: r.val, x: dest.x, y: dest.y });
                }
            }
        }

        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                if (prev[x][y] !== 0 && !consumedPrev.has(`${x},${y}`)) {
                    removes.push({ x, y, key: `${x},${y}` });
                }
            }
        }

        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const cv = this.game.grid.cells[x][y];
                if (cv !== 0 && movedGrid[x][y] === 0) {
                    spawns.push({ value: cv, x, y });
                }
            }
        }

        return { moves, spawns, merges, removes };
    }

    moveTile(m) {
        if (!this.tileContainer) return;
        const el = this.tileContainer.querySelector(`.tile[data-key="${m.fromX},${m.fromY}"]`);
        if (!el) {
            this.spawnTile({ value: m.value, x: m.x, y: m.y });
            return;
        }

        const src = this._pos(m.fromX, m.fromY);
        const dest = this._pos(m.x, m.y);

        el.style.transition = 'none';
        el.style.opacity = '1';
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