import { Evaluator } from './evaluator.js';
import { gridToBB, bbToGrid, move, getEmptyCells, hasAvailableMoves } from './bitboard.js';

export class ExpectimaxAI {
    constructor(depth = 5) {
        this.depth = depth;
        this.evaluator = new Evaluator();
        this.nodesEvaluated = 0;
        this.transpositionTable = new Map();
        this.maxTableSize = 20000;
        this.moveOrder = [1, 2, 3, 0];
    }

    setDepth(depth) {
        this.depth = depth;
    }

    getBestMove(game, depth = this.depth) {
        const grid = game.getGrid();
        const bb = gridToBB(grid);
        let bestScore = -Infinity;
        let bestDirection = null;

        for (const direction of this.moveOrder) {
            const result = move(bb, direction);
            if (result.moved) {
                const score = this.expectimax(result.bb, depth - 1, false) + result.scoreDelta;
                if (score > bestScore) {
                    bestScore = score;
                    bestDirection = direction;
                }
                if (score > 1000000) break;
            }
        }
        return bestDirection;
    }

    expectimax(bb, depth, isMaxPlayer) {
        this.nodesEvaluated++;

        if (depth === 0 || !hasAvailableMoves(bb)) {
            return this.evaluator.evaluate(bbToGrid(bb));
        }

        const gridKey = bb.toString() + ":" + depth + (isMaxPlayer ? "m" : "c");
        if (this.transpositionTable.has(gridKey)) {
            return this.transpositionTable.get(gridKey);
        }

        let score;

        if (isMaxPlayer) {
            let bestScore = -Infinity;
            for (const direction of this.moveOrder) {
                const result = move(bb, direction);
                if (result.moved) {
                    const moveScore = this.expectimax(result.bb, depth - 1, false) + result.scoreDelta;
                    bestScore = Math.max(bestScore, moveScore);
                }
                if (bestScore > 500000 && depth > 3) break;
                if (result.moved && result.scoreDelta > 5000 && depth > 2) break;
            }
            score = bestScore === -Infinity ? this.evaluator.evaluate(bbToGrid(bb)) : bestScore;
        } else {
            const availablePositions = getEmptyCells(bb);
            if (availablePositions.length === 0) {
                score = this.evaluator.evaluate(bbToGrid(bb));
            } else {
                let totalScore = 0;
                const sampleSize = Math.min(3, availablePositions.length);
                const selectedPositions = this.selectPositionsForSampling(availablePositions, bb, sampleSize);

                for (const pos of selectedPositions) {
                    let bbWith2 = bb | (1n << BigInt(4 * (pos.x + 4 * pos.y)));
                    totalScore += 0.9 * this.expectimax(bbWith2, depth - 1, true);
                    let bbWith4 = bb | (2n << BigInt(4 * (pos.x + 4 * pos.y)));
                    totalScore += 0.1 * this.expectimax(bbWith4, depth - 1, true);
                }
                score = totalScore / selectedPositions.length;
            }
        }

        if (this.transpositionTable.size >= this.maxTableSize) {
            let cleared = 0;
            for (const key of this.transpositionTable.keys()) {
                this.transpositionTable.delete(key);
                if (++cleared >= this.maxTableSize / 2) break;
            }
        }
        this.transpositionTable.set(gridKey, score);
        return score;
    }

    selectPositionsForSampling(positions, bb, sampleSize) {
        if (positions.length <= sampleSize) return positions;

        const positionScores = positions.map(pos => {
            let adjacentSum = 0;
            let adjacentCount = 0;
            const dirs = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];

            for (const dir of dirs) {
                const nx = pos.x + dir.x, ny = pos.y + dir.y;
                if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4) {
                    const shift = 4 * (nx + 4 * ny);
                    const v = Number((bb >> BigInt(shift)) & 0xFn);
                    if (v > 0) { adjacentSum += v; adjacentCount++; }
                }
            }

            const edgeBonus = (pos.x === 0 || pos.x === 3 || pos.y === 0 || pos.y === 3) ? 2 : 0;
            const cornerBonus = ((pos.x === 0 || pos.x === 3) && (pos.y === 0 || pos.y === 3)) ? 3 : 0;

            return {
                pos,
                score: (adjacentCount > 0 ? adjacentSum / adjacentCount : 0) + edgeBonus + cornerBonus
            };
        });

        positionScores.sort((a, b) => b.score - a.score);
        return positionScores.slice(0, sampleSize).map(item => item.pos);
    }
}