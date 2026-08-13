/**
 * 多线程 AI 搜索 — 通过 Web Worker 在后台线程运行 Expectimax
 */
let worker = null;
let taskId = 0;
const pending = new Map();

function getWorker() {
    if (worker) return worker;
    worker = new Worker('src/ai/ai-worker.js', { type: 'module' });
    worker.onmessage = function(e) {
        const { taskId: id, direction, nodesEvaluated } = e.data;
        const resolve = pending.get(id);
        if (resolve) {
            pending.delete(id);
            resolve({ direction, nodesEvaluated });
        }
    };
    worker.onerror = function(err) {
        for (const [id, resolve] of pending) {
            resolve({ direction: null, nodesEvaluated: 0, error: err.message });
        }
        pending.clear();
    };
    return worker;
}

/**
 * 在 worker 线程中运行 AI 搜索
 * @param {number[][]} grid - 当前棋盘 (grid[x][y])
 * @param {number} depth - 搜索深度
 * @returns {Promise<{direction: number|null, nodesEvaluated: number}>}
 */
export function runSearch(grid, depth) {
    return new Promise((resolve) => {
        const id = ++taskId;
        pending.set(id, resolve);
        try {
            const w = getWorker();
            w.postMessage({ taskId: id, grid, depth });
        } catch (e) {
            pending.delete(id);
            resolve({ direction: null, nodesEvaluated: 0, error: e.message });
        }
    });
}

/**
 * 终止 worker（页面关闭时调用）
 */
export function terminate() {
    if (worker) {
        worker.terminate();
        worker = null;
    }
    pending.clear();
}