
/**
 * Tetris Game Logic
 * "OrjusVanillaWeb" style adaptation
 */

class TetrisAudio {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.ctx.destination);
            this.gainNode.gain.value = 0.1; // Low volume
        } catch (e) {
            console.warn("Audio disabled:", e);
            this.ctx = null;
        }
    }

    playTone(freq, type, duration) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    move() { this.playTone(200, 'square', 0.1); }
    rotate() { this.playTone(400, 'triangle', 0.1); }
    drop() { this.playTone(100, 'sawtooth', 0.2); }
    hardDrop() { this.playTone(150, 'square', 0.15); }
    lock() { this.playTone(100, 'sine', 0.1); }
    clear() {
        if (!this.ctx) return;
        // Arpeggio
        let now = this.ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.frequency.value = freq;
            osc.type = 'sine';
            const gain = this.ctx.createGain();
            gain.gain.value = 0.1;
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1 + (i * 0.1));
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + (i * 0.05));
            osc.stop(now + 0.5);
        });
    }
}

class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('tetris-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('next-piece-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');

        this.audio = new TetrisAudio();

        // Game Settings
        this.cols = 10;
        this.rows = 20;
        this.blockSize = 30;

        // Scale for high DPI
        this.scaleCanvas(this.canvas, this.cols * this.blockSize, this.rows * this.blockSize);
        this.scaleCanvas(this.nextCanvas, 120, 120);

        this.board = this.createGrid(this.cols, this.rows);

        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;

        this.pieces = 'IJLOSTZ';
        this.colors = {
            'I': '#00f0f0',
            'J': '#0000f0',
            'L': '#f0a000',
            'O': '#f0f000',
            'S': '#00f000',
            'T': '#a000f0',
            'Z': '#f00000'
        };

        this.piece = null;
        this.nextPieceVal = null;

        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false,
            shift: false
        };

        // Bind methods
        this.update = this.update.bind(this);


        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Initialize state
        this.reset();
        this.paused = true; // Start paused
    }

    scaleCanvas(canvas, w, h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
    }

    createGrid(w, h) {
        return Array.from({ length: h }, () => Array(w).fill(0));
    }

    start() {
        this.reset();
        this.update();
    }

    reset() {
        this.board = this.createGrid(this.cols, this.rows);
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.piece = this.randomPiece();
        this.nextPieceVal = this.randomPiece();
        this.dropInterval = 1000;
        this.updateScore();
    }

    randomPiece() {
        const type = this.pieces[Math.floor(Math.random() * this.pieces.length)];
        return {
            matrix: this.createPieceMatrix(type),
            pos: { x: (this.cols / 2 | 0) - 1, y: 0 },
            type: type
        };
    }

    createPieceMatrix(type) {
        if (type === 'I') {
            return [
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
            ];
        } else if (type === 'L') {
            return [
                [0, 2, 0],
                [0, 2, 0],
                [0, 2, 2],
            ];
        } else if (type === 'J') {
            return [
                [0, 3, 0],
                [0, 3, 0],
                [3, 3, 0],
            ];
        } else if (type === 'O') {
            return [
                [4, 4],
                [4, 4],
            ];
        } else if (type === 'Z') {
            return [
                [5, 5, 0],
                [0, 5, 5],
                [0, 0, 0],
            ];
        } else if (type === 'S') {
            return [
                [0, 6, 6],
                [6, 6, 0],
                [0, 0, 0],
            ];
        } else if (type === 'T') {
            return [
                [0, 7, 0],
                [7, 7, 7],
                [0, 0, 0],
            ];
        }
    }

    drawMatrix(matrix, offset, ctx = this.ctx, ghost = false) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = ghost ? 'rgba(255, 255, 255, 0.2)' : this.getColor(value);
                    ctx.fillRect((x + offset.x) * this.blockSize, (y + offset.y) * this.blockSize, this.blockSize, this.blockSize);

                    // Stroke for style
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#18181b'; // Card background color
                    ctx.strokeRect((x + offset.x) * this.blockSize, (y + offset.y) * this.blockSize, this.blockSize, this.blockSize);
                }
            });
        });
    }

    getColor(val) {
        // We can either use fixed colors or theme colors
        // For gameplay clarity, fixed colors are better, but we can tint them
        const map = [null, '#00f0f0', '#f0a000', '#0000f0', '#f0f000', '#f00000', '#00f000', '#a000f0'];
        return map[val];
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#0f0f0f'; // Background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines (optional, subtle)
        this.ctx.strokeStyle = '#27272a';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.cols; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.blockSize, 0);
            this.ctx.lineTo(x * this.blockSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.rows; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.blockSize);
            this.ctx.lineTo(this.canvas.width, y * this.blockSize);
            this.ctx.stroke();
        }

        // Draw Board
        this.drawMatrix(this.board, { x: 0, y: 0 });

        // Line Clear Animation
        if (this.isClearing && this.clearingRows) {
            const alpha = Math.abs(Math.sin(this.clearingTimer / 50)); // Flash effect
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.clearingRows.forEach(y => {
                this.ctx.fillRect(0, y * this.blockSize, this.canvas.width, this.blockSize);
            });
            return; // Don't draw piece during clear animation
        }

        // Draw Ghost Piece
        if (this.piece) {
            const ghostPos = { ...this.piece.pos };
            while (!this.collide(this.board, { ...this.piece, pos: ghostPos })) {
                ghostPos.y++;
            }
            ghostPos.y--; // Back up one
            this.drawMatrix(this.piece.matrix, ghostPos, this.ctx, true);

            // Draw Active Piece
            this.drawMatrix(this.piece.matrix, this.piece.pos);
        }

        // Draw Next Piece
        this.nextCtx.fillStyle = '#18181b';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        if (this.nextPieceVal) {
            // Center the piece
            const offsetX = (4 - this.nextPieceVal.matrix[0].length) / 2;
            const offsetY = (4 - this.nextPieceVal.matrix.length) / 2;
            this.drawMatrix(this.nextPieceVal.matrix, { x: offsetX, y: offsetY }, this.nextCtx);
        }
    }

    collide(board, piece) {
        const m = piece.matrix;
        const o = piece.pos;
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 &&
                    (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    merge(board, piece) {
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    board[y + piece.pos.y][x + piece.pos.x] = value;
                }
            });
        });
    }

    rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) {
                [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
            }
        }
        if (dir > 0) {
            matrix.forEach(row => row.reverse());
        } else {
            matrix.reverse();
        }
    }

    playerReset() {
        this.piece = this.nextPieceVal;
        this.nextPieceVal = this.randomPiece();
        this.piece.pos.y = 0;
        this.piece.pos.x = (this.cols / 2 | 0) - (this.piece.matrix[0].length / 2 | 0);

        if (this.collide(this.board, this.piece)) {
            this.gameOver = true;
            alert("Game Over! Score: " + this.score);
            this.reset(); // Or just stop
        }
    }

    playerDrop() {
        this.piece.pos.y++;
        if (this.collide(this.board, this.piece)) {
            this.piece.pos.y--;
            this.merge(this.board, this.piece);
            this.audio.lock();
            this.playerReset();
            this.arenaSweep();
            this.updateScore();
        }
        this.dropCounter = 0;
    }

    playerMove(dir) {
        this.piece.pos.x += dir;
        if (this.collide(this.board, this.piece)) {
            this.piece.pos.x -= dir;
        } else {
            this.audio.move();
        }
    }

    playerRotate(dir) {
        const pos = this.piece.pos.x;
        let offset = 1;
        this.rotate(this.piece.matrix, dir);
        while (this.collide(this.board, this.piece)) {
            this.piece.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.piece.matrix[0].length) {
                this.rotate(this.piece.matrix, -dir);
                this.piece.pos.x = pos;
                return;
            }
        }
        this.audio.rotate();
    }

    playerHardDrop() {
        while (!this.collide(this.board, this.piece)) {
            this.piece.pos.y++;
            this.score += 2; // Hard drop points
        }
        this.piece.pos.y--;
        this.merge(this.board, this.piece);
        this.audio.hardDrop();
        this.playerReset();
        this.arenaSweep();
        this.updateScore();
        this.dropCounter = 0;
    }

    arenaSweep() {
        let rowCount = 0;
        let rowsToClear = [];

        // Find rows
        for (let y = this.board.length - 1; y > 0; --y) {
            let full = true;
            for (let x = 0; x < this.board[y].length; ++x) {
                if (this.board[y][x] === 0) {
                    full = false;
                    break;
                }
            }
            if (full) {
                rowsToClear.push(y);
            }
        }

        if (rowsToClear.length > 0) {
            this.audio.clear();
            // Pause game for animation
            this.isClearing = true;
            this.clearingRows = rowsToClear;
            this.clearingTimer = 0;

            // Score immediately
            const lineScores = [0, 100, 300, 500, 800];
            this.score += lineScores[rowsToClear.length] * this.level;
            this.lines += rowsToClear.length;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
        }
    }

    finalizeClear() {
        // Rebuild board: Keep rows NOT in clearingRows
        const newBoard = this.board.filter((_, idx) => !this.clearingRows.includes(idx));

        // Add new empty rows at top
        while (newBoard.length < this.rows) {
            newBoard.unshift(Array(this.cols).fill(0));
        }

        this.board = newBoard;
        this.isClearing = false;
        this.clearingRows = [];
    }

    update(time = 0) {
        if (this.gameOver || this.paused) {
            if (!this.gameOver) requestAnimationFrame(this.update);
            return;
        }

        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        // Handle Line Clear Animation
        if (this.isClearing) {
            this.clearingTimer += deltaTime;
            if (this.clearingTimer > 300) { // 300ms animation
                this.finalizeClear();
            }
            // Redraw with animation effect
            this.draw();
            requestAnimationFrame(this.update);
            return;
        }

        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.playerDrop();
        }

        this.draw();
        requestAnimationFrame(this.update);
    }

    updateScore() {
        document.getElementById('tetris-score').innerText = this.score;
        document.getElementById('tetris-lines').innerText = this.lines;
        document.getElementById('tetris-level').innerText = this.level;
    }

    handleKeyDown(event) {
        if (document.getElementById('tetris-modal').style.display === 'none') return;

        // Prevent default scrolling for game keys
        const code = event.code;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(code) > -1) {
            event.preventDefault();
        }

        if (code === 'KeyP' || code === 'Escape') {
            this.togglePause();
            return;
        }

        if (this.paused || this.gameOver) return;

        // Uses physical keys (works with any language layout)
        // Debug keys
        // console.log(event.code, event.key);

        // Movement
        if (code === 'KeyA' || code === 'ArrowLeft' || event.key === 'a' || event.key === 'ф') {
            this.playerMove(-1);
        } else if (code === 'KeyD' || code === 'ArrowRight' || event.key === 'd' || event.key === 'в') {
            this.playerMove(1);
        } else if (code === 'KeyS' || code === 'ArrowDown' || event.key === 's' || event.key === 'ы') {
            this.playerDrop();
            this.score += 1;
            this.updateScore();
        } else if (code === 'KeyW' || code === 'ArrowUp' || event.key === 'w' || event.key === 'ц') {
            this.playerRotate(1);
        } else if (code === 'Space') {
            this.playerHardDrop();
        } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
            this.togglePause();
        }
    }

    handleKeyUp(event) {
        // Implement repeat rate if needed, but for now simple press is fine
    }

    togglePause() {
        this.paused = !this.paused;
        if (this.paused) {
            this.showPauseMenu();
        } else {
            this.hidePauseMenu();
            this.lastTime = performance.now();
            this.update();
        }
    }

    showPauseMenu() {
        const overlay = document.getElementById('tetris-pause-overlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = '<button id="tetris-start-btn" class="btn-primary" style="font-size: 1.5rem; padding: 1rem 3rem;">START GAME</button>';

        const btn = document.getElementById('tetris-start-btn');
        btn.onclick = (e) => {
            e.stopPropagation();
            if (this.gameOver) {
                this.reset();
            }
            this.togglePause();
        };
    }

    hidePauseMenu() {
        const overlay = document.getElementById('tetris-pause-overlay');
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    }
}

// Modal Logic
// Modal Logic
document.addEventListener('DOMContentLoaded', () => {
    let game = null;
    const modal = document.getElementById('tetris-modal');
    const openBtn = document.getElementById('tetris-open-btn');
    const closeBtn = document.getElementById('tetris-close-btn');

    if (!openBtn || !modal || !closeBtn) {
        console.error("Tetris elements not found!");
        return;
    }

    openBtn.addEventListener('click', () => {
        // Initialize game on first click
        if (!game) {
            try {
                game = new TetrisGame();
                window.tetrisGame = game;
            } catch (e) {
                console.error("Failed to initialize Tetris:", e);
                return;
            }
        }

        modal.style.display = 'flex';

        // Resume Audio Context if suspended
        if (game.audio && game.audio.ctx && game.audio.ctx.state === 'suspended') {
            game.audio.ctx.resume();
        }

        // Show start menu immediately
        game.paused = true;
        game.showPauseMenu();

        // Initial render so it's not blank
        game.draw();
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (game) game.paused = true;
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (game) game.paused = true;
            if (game) game.showPauseMenu();
        }
    });
});
