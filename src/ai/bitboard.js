/**
 * 2048 位棋盘（BitBoard）模块
 *
 * 棋盘用 64-bit BigInt 表示，每格 4 bit（0=空, 1=2, 2=4, 3=8, ...）
 * 布局：cell(x,y) 在 bit 4*(x + 4*y) 处
 * 行 y 在 bit 16*y 到 16*y+15
 * 列 x 在 bit 4*x, 4*x+16, 4*x+32, 4*x+48
 */
const SIZE = 4;
const CELL_BITS = 4;
const ROW_BITS = 16;
const CELL_MASK = 0xF;

// 预计算滑动+合并查找表
const ROW_SLIDE_LEFT  = new Uint16Array(65536);
const ROW_SLIDE_RIGHT = new Uint16Array(65536);
const ROW_SCORE_LEFT  = new Uint16Array(65536);
const ROW_SCORE_RIGHT = new Uint16Array(65536);
let tablesInitialized = false;

function initTables() {
    if (tablesInitialized) return;
    for (let row = 0; row < 65536; row++) {
        const a = (row >> 0)  & CELL_MASK;
        const b = (row >> 4)  & CELL_MASK;
        const c = (row >> 8)  & CELL_MASK;
        const d = (row >> 12) & CELL_MASK;

        // 左滑（向索引 0 方向合并）
        let arr = [a, b, c, d].filter(v => v !== 0);
        let scoreLeft = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] !== 0 && arr[i] === arr[i + 1]) {
                arr[i]++;
                scoreLeft += 1 << arr[i];
                arr[i + 1] = 0;
            }
        }
        arr = arr.filter(v => v !== 0);
        while (arr.length < 4) arr.push(0);
        ROW_SLIDE_LEFT[row]  = arr[0] | (arr[1] << 4) | (arr[2] << 8) | (arr[3] << 12);
        ROW_SCORE_LEFT[row]  = scoreLeft;

        // 右滑（向索引 3 方向合并）
        arr = [a, b, c, d].filter(v => v !== 0);
        let scoreRight = 0;
        for (let i = arr.length - 1; i > 0; i--) {
            if (arr[i] !== 0 && arr[i] === arr[i - 1]) {
                arr[i]++;
                scoreRight += 1 << arr[i];
                arr[i - 1] = 0;
            }
        }
        arr = arr.filter(v => v !== 0);
        while (arr.length < 4) arr.unshift(0);
        ROW_SLIDE_RIGHT[row] = arr[0] | (arr[1] << 4) | (arr[2] << 8) | (arr[3] << 12);
        ROW_SCORE_RIGHT[row] = scoreRight;
    }
    tablesInitialized = true;
}

/**
 * 将 2D 数组（grid[x][y] = 2/4/8/...）转换为 BigInt 位棋盘
 */
export function gridToBB(grid) {
    let bb = 0n;
    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            const val = grid[x][y];
            if (val !== 0) {
                const exp = Math.log2(val);
                bb |= BigInt(exp) << BigInt(CELL_BITS * (x + SIZE * y));
            }
        }
    }
    return bb;
}

/**
 * 将 BigInt 位棋盘转换为 2D 数组（grid[x][y] = 2/4/8/...）
 */
export function bbToGrid(bb) {
    const grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            const exp = Number((bb >> BigInt(CELL_BITS * (x + SIZE * y))) & BigInt(CELL_MASK));
            if (exp !== 0) grid[x][y] = 1 << exp;
        }
    }
    return grid;
}

function getRow(bb, y) {
    return Number((bb >> BigInt(ROW_BITS * y)) & 0xFFFFn);
}

function setRow(bb, y, row) {
    const mask = 0xFFFFn << BigInt(ROW_BITS * y);
    return (bb & ~mask) | (BigInt(row) << BigInt(ROW_BITS * y));
}

function getCol(bb, x) {
    const shift = CELL_BITS * x;
    return Number(
        ((bb >> BigInt(shift))        & 0xFn) |
        ((bb >> BigInt(shift + 16))   & 0xFn) << 4n  |
        ((bb >> BigInt(shift + 32))   & 0xFn) << 8n  |
        ((bb >> BigInt(shift + 48))   & 0xFn) << 12n
    );
}

function setCol(bb, x, col) {
    const shift = CELL_BITS * x;
    const mask = 0xFn;
    const c0 = BigInt(col & 0xF);
    const c1 = BigInt((col >> 4) & 0xF);
    const c2 = BigInt((col >> 8) & 0xF);
    const c3 = BigInt((col >> 12) & 0xF);
    bb = (bb & ~(mask     << BigInt(shift)))       | (c0 << BigInt(shift));
    bb = (bb & ~(mask     << BigInt(shift + 16)))  | (c1 << BigInt(shift + 16));
    bb = (bb & ~(mask     << BigInt(shift + 32)))  | (c2 << BigInt(shift + 32));
    bb = (bb & ~(mask     << BigInt(shift + 48)))  | (c3 << BigInt(shift + 48));
    return bb;
}

/**
 * 执行一次移动，返回 { bb, moved, scoreDelta }
 */
export function move(bb, direction) {
    initTables();
    let scoreDelta = 0;
    let moved = false;

    if (direction === 0) {       // 上
        for (let x = 0; x < SIZE; x++) {
            const col = getCol(bb, x);
            const newCol = ROW_SLIDE_LEFT[col];
            if (newCol !== col) moved = true;
            scoreDelta += ROW_SCORE_LEFT[col];
            bb = setCol(bb, x, newCol);
        }
    } else if (direction === 1) { // 右
        for (let y = 0; y < SIZE; y++) {
            const row = getRow(bb, y);
            const newRow = ROW_SLIDE_RIGHT[row];
            if (newRow !== row) moved = true;
            scoreDelta += ROW_SCORE_RIGHT[row];
            bb = setRow(bb, y, newRow);
        }
    } else if (direction === 2) { // 下
        for (let x = 0; x < SIZE; x++) {
            const col = getCol(bb, x);
            const newCol = ROW_SLIDE_RIGHT[col];
            if (newCol !== col) moved = true;
            scoreDelta += ROW_SCORE_RIGHT[col];
            bb = setCol(bb, x, newCol);
        }
    } else {                      // 左
        for (let y = 0; y < SIZE; y++) {
            const row = getRow(bb, y);
            const newRow = ROW_SLIDE_LEFT[row];
            if (newRow !== row) moved = true;
            scoreDelta += ROW_SCORE_LEFT[row];
            bb = setRow(bb, y, newRow);
        }
    }

    return { bb, moved, scoreDelta };
}

/**
 * 获取空位列表
 */
export function getEmptyCells(bb) {
    const cells = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const shift = CELL_BITS * (x + SIZE * y);
            if ((bb & (BigInt(CELL_MASK) << BigInt(shift))) === 0n) {
                cells.push({ x, y });
            }
        }
    }
    return cells;
}

/**
 * 在随机空位添加新方块，返回 { bb, value }
 */
export function insertRandom(bb) {
    const cells = getEmptyCells(bb);
    if (cells.length === 0) return { bb, value: 0 };
    const pos = cells[Math.floor(Math.random() * cells.length)];
    const val = Math.random() < 0.9 ? 1 : 2; // 90% 2 (exp=1), 10% 4 (exp=2)
    const shift = CELL_BITS * (pos.x + SIZE * pos.y);
    bb |= BigInt(val) << BigInt(shift);
    return { bb, value: 1 << val };
}

/**
 * 检查是否有可用移动
 */
export function hasAvailableMoves(bb) {
    initTables();
    // 检查是否有空格
    if (getEmptyCells(bb).length > 0) return true;
    // 检查是否有相邻同值方块
    for (let y = 0; y < SIZE; y++) {
        const row = getRow(bb, y);
        for (let x = 0; x < SIZE - 1; x++) {
            const v = (row >> (CELL_BITS * x)) & CELL_MASK;
            const n = (row >> (CELL_BITS * (x + 1))) & CELL_MASK;
            if (v !== 0 && v === n) return true;
        }
    }
    for (let x = 0; x < SIZE; x++) {
        const col = getCol(bb, x);
        for (let y = 0; y < SIZE - 1; y++) {
            const v = (col >> (CELL_BITS * y)) & CELL_MASK;
            const n = (col >> (CELL_BITS * (y + 1))) & CELL_MASK;
            if (v !== 0 && v === n) return true;
        }
    }
    return false;
}

/**
 * 获取最高方块的指数
 */
export function getHighestExp(bb) {
    let highest = 0;
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const shift = CELL_BITS * (x + SIZE * y);
            const exp = Number((bb >> BigInt(shift)) & BigInt(CELL_MASK));
            if (exp > highest) highest = exp;
        }
    }
    return highest;
}