import { GameCore } from './game/core.js';
import { GameAI } from './ai/main.js';
import { Renderer } from './ui/renderer.js';

/**
 * 2048游戏主控制器
 * 协调游戏逻辑、AI和UI组件
 */
export class GameController {
    constructor() {
        this.game = new GameCore();
        this.ai = new GameAI(this.game);
        this.renderer = new Renderer(this.game);
        
        this.autoPlayInterval = null;
        
        this.init();
    }

    /**
     * 初始化游戏
     */
    init() {
        // 重置游戏
        this.game.reset();
        
        // 渲染初始状态
        this.renderer.render();
        
        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 键盘事件
        this.bindKeyboardEvents();
        
        // 按钮事件
        this.bindButtonEvents();
        
        // AI控制事件
        this.bindAIControlEvents();
    }

    /**
     * 绑定键盘事件
     */
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.game.isGameOver()) return;
            
            let direction = null;
            let moved = false;
            
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    direction = 0; // 上
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    direction = 1; // 右
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    direction = 2; // 下
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    direction = 3; // 左
                    break;
            }
            
            if (direction !== null) {
                moved = this.game.move(direction);
                
                if (moved) {
                    this.renderer.render();
                    this.checkGameStatus();
                }
            }
        });
    }

    /**
     * 绑定按钮事件
     */
    bindButtonEvents() {
        const retryButton = document.querySelector('.retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.restart();
            });
        }
    }

    /**
     * 绑定AI控制事件
     */
    bindAIControlEvents() {
        // 算法选择
        const algorithmSelect = document.getElementById('ai-algorithm');
        if (algorithmSelect) {
            algorithmSelect.addEventListener('change', (e) => {
                this.ai.setAlgorithm(e.target.value);
                this.updateCurrentAlgorithmDisplay(e.target.value);
            });
        }
        
        // 搜索深度
        const depthSlider = document.getElementById('ai-depth');
        const depthValue = document.getElementById('depth-value');
        if (depthSlider && depthValue) {
            // 设置默认值
            depthSlider.value = "5";
            depthValue.textContent = "5";
            this.ai.setDepth(5);
            
            depthSlider.addEventListener('input', () => {
                depthValue.textContent = depthSlider.value;
                this.ai.setDepth(parseInt(depthSlider.value));
            });
        }
        
        // AI移动按钮
        const aiMoveButton = document.getElementById('ai-move');
        if (aiMoveButton) {
            aiMoveButton.addEventListener('click', () => {
                this.ai.makeOneMove();
                this.renderer.render();
                this.checkGameStatus();
            });
        }
        
        // AI自动游戏按钮
        const aiAutoPlayButton = document.getElementById('ai-auto-play');
        if (aiAutoPlayButton) {
            aiAutoPlayButton.addEventListener('click', () => {
                if (!this.autoPlayInterval) {
                    this.autoPlayInterval = setInterval(() => {
                        this.ai.makeOneMove();
                        this.renderer.render();
                        this.checkGameStatus();
                    }, 100);
                }
            });
        }
        
        // 停止AI按钮
        const aiStopButton = document.getElementById('ai-stop');
        if (aiStopButton) {
            aiStopButton.addEventListener('click', () => {
                if (this.autoPlayInterval) {
                    clearInterval(this.autoPlayInterval);
                    this.autoPlayInterval = null;
                }
            });
        }
    }

    /**
     * 更新当前算法显示
     */
    updateCurrentAlgorithmDisplay(algorithm) {
        const element = document.getElementById('current-algorithm');
        if (element) {
            const names = {
                'expectimax': 'ExpectiMax (期望最大值)',
                'mcts': 'MCTS (蒙特卡洛树搜索)',
                'hybrid': 'Hybrid (混合算法)',
                'adaptive': '自适应 (动态选择最佳算法)'
            };
            element.textContent = names[algorithm] || algorithm;
        }
    }

    /**
     * 检查游戏状态
     */
    checkGameStatus() {
        const status = this.game.checkGameStatus();
        
        switch(status) {
            case 'won':
                this.renderer.showMessage('恭喜，你赢了！', 'game-won');
                break;
            case 'over':
                this.renderer.showMessage('游戏结束！', 'game-over');
                break;
            case 'playing':
                // 游戏继续，不显示消息
                this.renderer.hideMessage();
                break;
        }
    }

    /**
     * 重新开始游戏
     */
    restart() {
        this.game.reset();
        this.renderer.render();
        this.renderer.hideMessage();
        
        // 停止自动播放
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
}

// 当DOM加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new GameController();
});