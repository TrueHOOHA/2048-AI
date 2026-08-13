/**
 * AI Worker — 在独立线程中运行 Expectimax 搜索
 */
import { gridToBB, bbToGrid, move, getEmptyCells, hasAvailableMoves } from './bitboard.js';
import { Evaluator } from './evaluator.js';

self.onmessage = function(e) {
    const { grid, depth } = e.data;
    const bb = gridToBB(grid);
    const evaluator = new Evaluator();
    const transpositionTable = new Map();
    const maxTableSize = 20000;
    const moveOrder = [1, 2, 3, 0];
    let nodesEvaluated = 0;

    function selectPositionsForSampling(positions, bb, sampleSize) {
        if (positions.length <= sampleSize) return positions;
        const scored = positions.map(pos => {
            let sum = 0, cnt = 0;
            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            for (const d of dirs) {
                const nx = pos.x + d.x, ny = pos.y + d.y;
                if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4) {
                    const v = Number((bb >> BigInt(4 * (nx + 4 * ny))) & 0xFn);
                    if (v > 0) { sum += v; cnt++; }
                }
            }
            const edge = (pos.x === 0 || pos.x === 3 || pos.y === 0 || pos.y === 3) ? 2 : 0;
            const corner = ((pos.x === 0 || pos.x === 3) && (pos.y === 0 || pos.y === 3)) ? 3 : 0;
            return { pos, score: (cnt > 0 ? sum / cnt : 0) + edge + corner };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, sampleSize).map(x => x.pos);
    }

    function expectimax(bb, depth, isMaxPlayer) {
        nodesEvaluated++;
        if (depth === 0 || !hasAvailableMoves(bb)) {
            return evaluator.evaluate(bbToGrid(bb));
        }
        const key = bb.toString() + ":" + depth + (isMaxPlayer ? "m" : "c");
        if (transpositionTable.has(key)) return transpositionTable.get(key);

        let score;
        if (isMaxPlayer) {
            let best = -Infinity;
            for (const dir of moveOrder) {
                const r = move(bb, dir);
                if (r.moved) {
                    best = Math.max(best, expectimax(r.bb, depth - 1, false) + r.scoreDelta);
                }
                if (best > 500000 && depth > 3) break;
                if (r.moved && r.scoreDelta > 5000 && depth > 2) break;
            }
            score = best === -Infinity ? evaluator.evaluate(bbToGrid(bb)) : best;
        } else {
            const cells = getEmptyCells(bb);
            if (cells.length === 0) {
                score = evaluator.evaluate(bbToGrid(bb));
            } else {
                let total = 0;
                const n = Math.min(3, cells.length);
                const sel = selectPositionsForSampling(cells, bb, n);
                for (const pos of sel) {
                    const shift = 4 * (pos.x + 4 * pos.y);
                    total += 0.9 * expectimax(bb | (1n << BigInt(shift)), depth - 1, true);
                    total += 0.1 * expectimax(bb | (2n << BigInt(shift)), depth - 1, true);
                }
                score = total / n;
            }
        }
        if (transpositionTable.size >= maxTableSize) {
            let c = 0;
            for (const k of transpositionTable.keys()) {
                transpositionTable.delete(k);
                if (++c >= maxTableSize / 2) break;
            }
        }
        transpositionTable.set(key, score);
        return score;
    }

    let bestDir = null, bestScore = -Infinity;
    for (const dir of moveOrder) {
        const r = move(bb, dir);
        if (r.moved) {
            const s = expectimax(r.bb, depth - 1, false) + r.scoreDelta;
            if (s > bestScore) { bestScore = s; bestDir = dir; }
            if (s > 1000000) break;
        }
    }
    self.postMessage({ direction: bestDir, nodesEvaluated });
};