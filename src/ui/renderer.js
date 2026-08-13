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
        // 第一遍：识别哪些瓦片会被移动，记录它们的 key
        const movedKeys = new Set();
        this.identifyMoves(prev, movedKeys);

        // 第二遍：移除未移动的旧瓦片（带淡出动画）
        this.removeUnusedTiles(prev, movedKeys);
        // 第三遍：移动现有瓦片 + 创建新瓦片/合并瓦片
        this.updateTiles(prev, movedKeys);
        this.updateScore();
    }

    /**
     * 识别哪些瓦片会被移动，收集它们的 prev key 到 movedKeys
     */
    identifyMoves(prev, movedKeys) {
        if (!prev || !this.tileContainer) return;
        const curSet = new Set();
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (this.game.grid.cells[x][y] !== 0) curSet.add(`${x},${y}`);
            }
        }
        const processed = new Set();
        for (const ckey of curSet) {
            const [cx, cy] = ckey.split(',').map(Number);
            const cv = this.game.grid.cells[cx][cy];
            if (prev[cx][cy] === cv) { processed.add(ckey); continue; }
            if (prev[cx][cy] !== undefined && cv > prev[cx][cy]) { processed.add(ckey); continue; }
            for (let px = 0; px < this.game.size; px++) {
                for (let py = 0; py < this.game.size; py++) {
                    const pkey = `${px},${py}`;
                    if (processed.has(pkey)) continue;
                    if (prev[px][py] === cv) {
                        const el = this.tileContainer.querySelector(`.tile[data-key="${pkey}"]`);
                        if (el) {
                            movedKeys.add(pkey);
                            processed.add(ckey);
                            processed.add(pkey);
                            break;
                        }
                    }
                }
            }
        }
    }

    /**
     * 移除 prev 中存在但当前不存在且未被移动的瓦片（带淡出动画）
     */
    removeUnusedTiles(prev, movedKeys) {
        if (!this.tileContainer || !prev) return;
        const curSet = new Set();
        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                if (this.game.grid.cells[x][y] !== 0) curSet.add(`${x},${y}`);
            }
        }
        for (const key of movedKeys) curSet.delete(key);
        for (const key of curSet) {
            const el = this.tileContainer.querySelector(`.tile[data-key="${key}"]`);
            if (el) {
                el.style.transition = 'opacity 0.12s';
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 130);
            }
        }
    }

    /**
     * 更新瓦片：移动已有瓦片，创建新瓦片和合并瓦片
     */
    updateTiles(prev, movedKeys) {
        if (!this.tileContainer) return;
        const processed = new Set(movedKeys);

        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const val = this.game.grid.cells[x][y];
                if (val === 0) continue;
                const key = `${x},${y}`;

                if (prev && prev[x][y] === val) {
                    processed.add(key);
                    continue;
                }

                if (prev && prev[x][y] !== undefined && val > prev[x][y]) {
                    // 合并：先清除旧瓦片，再创建新瓦片
                    const oldEl = this.tileContainer.querySelector(`.tile[data-key="${key}"]`);
                    if (oldEl) oldEl.remove();
                    this.createTile(val, x, y, true);
                    processed.add(key);
                    continue;
                }

                if (prev && processed.has(key)) continue;

                // 查找同值的 prev 瓦片并移动它
                let movedEl = null;
                if (prev) {
                    outer:
                    for (let px = 0; px < this.game.size; px++) {
                        for (let py = 0; py < this.game.size; py++) {
                            const pKey = `${px},${py}`;
                            if (processed.has(pKey)) continue;
                            if (prev[px][py] === val) {
                                movedEl = this.tileContainer.querySelector(`.tile[data-key="${pKey}"]`);
                                if (movedEl) {
                                    this.moveTile(movedEl, px, py, x, y);
                                    processed.add(pKey);
                                    processed.add(key);
                                    break outer;
                                }
                            }
                        }
                    }
                }

                if (movedEl) continue;
                this.createTile(val, x, y, false);
                processed.add(key);
            }
        }
    }

    /**
     * 移动瓦片：更新 DOM 的 transform，触发 CSS transition
     */
    moveTile(el, fromX, fromY, toX, toY) {
        // 移除旧位置类，添加新位置类 → CSS transition 生效
        el.classList.remove(`tile-position-${fromX + 1}-${fromY + 1}`);
        el.classList.add(`tile-position-${toX + 1}-${toY + 1}`);
        el.dataset.key = `${toX},${toY}`;
    }

    /**
     * 创建瓦片 DOM 元素
     * @param {number} value
     * @param {number} x
     * @param {number} y
     * @param {boolean} merged
     */
    createTile(value, x, y, merged = false) {
        if (!this.tileContainer) return;

        const tile = document.createElement('div');
        tile.className = `tile tile-${value}${merged ? ' tile-merged' : ' tile-new'}`;
        tile.dataset.key = `${x},${y}`;
        tile.textContent = value;
        tile.classList.add(`tile-position-${x + 1}-${y + 1}`);
        this.tileContainer.appendChild(tile);

        if (merged) {
            setTimeout(() => tile.classList.remove('tile-merged'), 200);
        } else {
            setTimeout(() => tile.classList.remove('tile-new'), 300);
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
