/**
 * 2048游戏渲染器
 * 每次重建DOM，用transform动画驱动移动/合并/生成
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
        if (!this.tileContainer) return;
        const { moves, spawns, merges, removes } = this.computeDiff(prev, direction);

        this.tileContainer.innerHTML = '';

        const moveKeys = new Set(moves.map(m => `${m.x},${m.y}`));
        const spawnKeys = new Set(spawns.map(s => `${s.x},${s.y}`));
        const mergeKeys = new Set(merges.map(m => `${m.x},${m.y}`));

        // 静止瓦片：直接创建
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const v = this.game.grid.cells[x][y];
                if (v === 0) continue;
                const key = `${x},${y}`;
                if (moveKeys.has(key) || spawnKeys.has(key) || mergeKeys.has(key)) continue;
                this.tileContainer.appendChild(this._createTileEl(v, x, y));
            }
        }

        // 移动瓦片：先 offset 到源位置，再滑到目标
        for (const m of moves) {
            const srcPos = this._pos(m.fromX, m.fromY);
            const destPos = this._pos(m.x, m.y);
            const tile = this._createTileEl(m.value, m.x, m.y);
            tile.style.transition = 'none';
            tile.style.transform = `translate(${srcPos.px - destPos.px}px, ${srcPos.py - destPos.py}px)`;
            this.tileContainer.appendChild(tile);
            void tile.offsetWidth;
            tile.style.transition = 'transform 0.15s ease-in-out';
            tile.style.transform = 'translate(0, 0)';
            setTimeout(() => { tile.style.transition = ''; }, 150);
        }

        // 生成瓦片：缩放出现
        for (const s of spawns) {
            const tile = this._createTileEl(s.value, s.x, s.y);
            tile.style.transition = 'none';
            tile.style.transform = 'scale(0)';
            tile.style.opacity = '0';
            this.tileContainer.appendChild(tile);
            void tile.offsetWidth;
            tile.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
            tile.style.transform = 'scale(1)';
            tile.style.opacity = '1';
            setTimeout(() => { tile.style.transition = ''; }, 200);
        }

        // 合并瓦片：弹跳出现
        for (const m of merges) {
            const tile = this._createTileEl(m.value, m.x, m.y);
            this.tileContainer.appendChild(tile);
            void tile.offsetWidth;
            tile.style.transition = 'transform 0.1s ease-out';
            tile.style.transform = 'scale(1.2)';
            setTimeout(() => {
                tile.style.transform = 'scale(1)';
                setTimeout(() => { tile.style.transition = ''; }, 100);
            }, 100);
        }

        this.updateScore();
    }

    _createTileEl(value, x, y) {
        const pos = this._pos(x, y);
        const tile = document.createElement('div');
        tile.className = `tile tile-${value}`;
        tile.dataset.pos = `${x},${y}`;
        tile.textContent = value;
        tile.style.left = pos.px + 'px';
        tile.style.top = pos.py + 'px';
        return tile;
    }

    computeDiff(prev, direction) {
        const moves = [];
        const spawns = [];
        const merges = [];
        const removes = [];
        const size = this.game.size;
        const movedGrid = Array.from({ length: size }, () => new Array(size).fill(0));
        const consumedPrev = new Set();

        const buildLines = () => {
            const lines = [];
            if (direction === 0) {
                for (let x = 0; x < size; x++) {
                    const c = []; for (let y = 0; y < size; y++) c.push({ x, y });
                    lines.push({ cells: c });
                }
            } else if (direction === 1) {
                for (let y = 0; y < size; y++) {
                    const c = []; for (let x = size - 1; x >= 0; x--) c.push({ x, y });
                    lines.push({ cells: c });
                }
            } else if (direction === 2) {
                for (let x = 0; x < size; x++) {
                    const c = []; for (let y = size - 1; y >= 0; y--) c.push({ x, y });
                    lines.push({ cells: c });
                }
            } else {
                for (let y = 0; y < size; y++) {
                    const c = []; for (let x = 0; x < size; x++) c.push({ x, y });
                    lines.push({ cells: c });
                }
            }
            return lines;
        };

        if (!prev) {
            for (let x = 0; x < size; x++)
                for (let y = 0; y < size; y++)
                    if (this.game.grid.cells[x][y] !== 0)
                        spawns.push({ value: this.game.grid.cells[x][y], x, y });
            return { moves, spawns, merges, removes };
        }

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
                for (const src of r.srcs) consumedPrev.add(`${src.x},${src.y}`);
                if (r.srcs.length === 1) {
                    const s = r.srcs[0];
                    if (s.x !== dest.x || s.y !== dest.y) {
                        moves.push({ fromX: s.x, fromY: s.y, x: dest.x, y: dest.y, value: r.val });
                    }
                } else {
                    for (const src of r.srcs) removes.push({ x: src.x, y: src.y });
                    merges.push({ value: r.val, x: dest.x, y: dest.y });
                }
            }
        }

        for (let x = 0; x < size; x++)
            for (let y = 0; y < size; y++)
                if (prev[x][y] !== 0 && !consumedPrev.has(`${x},${y}`))
                    removes.push({ x, y });

        for (let x = 0; x < size; x++)
            for (let y = 0; y < size; y++)
                if (this.game.grid.cells[x][y] !== 0 && movedGrid[x][y] === 0)
                    spawns.push({ value: this.game.grid.cells[x][y], x, y });

        return { moves, spawns, merges, removes };
    }

    updateScore() {
        if (this.scoreContainer) this.scoreContainer.textContent = this.game.getScore();
        if (this.bestScoreContainer) this.bestScoreContainer.textContent = this.game.getBestScore();
    }

    showMessage(message, type = '') {
        if (this.messageContainer) {
            this.messageContainer.style.display = 'flex';
            this.messageContainer.classList.remove('game-won', 'game-over');
            if (type) this.messageContainer.classList.add(type);
            const p = this.messageContainer.querySelector('p');
            if (p) p.textContent = message;
        }
    }

    hideMessage() {
        if (this.messageContainer) this.messageContainer.style.display = 'none';
    }
}