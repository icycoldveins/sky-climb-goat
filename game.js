const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 600;
canvas.height = 700;

let gameState = 'start';
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
let camera = { y: 0 };

const goat = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    width: 45,
    height: 45,
    velocityX: 0,
    velocityY: 0,
    speed: 6,
    jumpPower: -11,
    gravity: 0.3,
    maxVelocity: 10,
    color: '#FFF',
    invincible: false,
    invincibleTime: 0,
    superJump: false,
    superJumpTime: 0,
    rotation: 0,
    targetRotation: 0,
    jumpSquash: 1,
    eyeBlink: 0
};

let platforms = [];
let enemies = [];
let powerUps = [];
let particles = [];

const platformTypes = {
    NORMAL: { color: '#8B4513', width: 85, height: 18, bounceMultiplier: 1 },
    BOUNCY: { color: '#00FF00', width: 85, height: 18, bounceMultiplier: 1.5 },
    BREAKING: { color: '#FF6B6B', width: 85, height: 18, bounceMultiplier: 1, breaks: true },
    MOVING: { color: '#FFD700', width: 85, height: 18, bounceMultiplier: 1, moves: true }
};

const powerUpTypes = {
    SUPER_JUMP: { color: '#FF00FF', symbol: '⚡', duration: 3000, effect: 'superJump' },
    INVINCIBILITY: { color: '#00FFFF', symbol: '🛡️', duration: 5000, effect: 'invincible' }
};

const keys = {};

class Platform {
    constructor(x, y, type = 'NORMAL') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = platformTypes[type];
        this.width = this.config.width;
        this.height = this.config.height;
        this.broken = false;
        this.velocity = this.config.moves ? (Math.random() < 0.5 ? 1 : -1) : 0;
        this.originalX = x;
    }

    update() {
        if (this.config.moves && !this.broken) {
            this.x += this.velocity;
            if (Math.abs(this.x - this.originalX) > 50) {
                this.velocity *= -1;
            }
        }
    }

    draw() {
        if (this.broken) return;
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 3;
        
        ctx.fillStyle = this.config.color;
        ctx.fillRect(this.x - this.width / 2, this.y - camera.y, this.width, this.height);
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(this.x - this.width / 2, this.y - camera.y + this.height - 3, this.width, 3);
        
        if (this.type === 'BOUNCY') {
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - this.width / 2, this.y - camera.y, this.width, this.height);
            
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = `rgba(0, 255, 0, ${0.1 - i * 0.03})`;
                ctx.fillRect(this.x - this.width / 2 - 2, this.y - camera.y + this.height + i * 2, this.width + 4, 2);
            }
        } else if (this.type === 'BREAKING') {
            ctx.strokeStyle = '#8B0000';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(this.x - this.width / 2, this.y - camera.y, this.width, this.height);
            ctx.setLineDash([]);
        } else if (this.type === 'MOVING') {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.fillRect(this.x - this.width / 2 - 2, this.y - camera.y - 2, this.width + 4, this.height + 4);
        }
    }

    checkCollision(goat) {
        if (this.broken) return false;
        
        if (goat.velocityY > 0 &&
            goat.x > this.x - this.width / 2 &&
            goat.x < this.x + this.width / 2 &&
            goat.y + goat.height / 2 > this.y &&
            goat.y + goat.height / 2 < this.y + this.height + 10) {
            
            if (this.config.breaks) {
                this.broken = true;
                createParticles(this.x, this.y, this.config.color);
            }
            
            return true;
        }
        return false;
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.velocity = (Math.random() - 0.5) * 2;
        this.amplitude = 30;
        this.originalX = x;
        this.time = 0;
    }

    update() {
        this.time += 0.05;
        this.x = this.originalX + Math.sin(this.time) * this.amplitude;
    }

    draw() {
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(this.x, this.y - camera.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFF';
        ctx.fillText('👹', this.x - 10, this.y - camera.y + 5);
    }

    checkCollision(goat) {
        const distance = Math.sqrt(
            Math.pow(goat.x - this.x, 2) + 
            Math.pow(goat.y - this.y, 2)
        );
        return distance < (this.width / 2 + goat.width / 2);
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = powerUpTypes[type];
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.float = 0;
    }

    update() {
        this.float += 0.1;
    }

    draw() {
        if (this.collected) return;
        
        const floatY = Math.sin(this.float) * 5;
        
        ctx.fillStyle = this.config.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(this.x, this.y - camera.y + floatY, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        ctx.font = '20px Arial';
        ctx.fillText(this.config.symbol, this.x - 10, this.y - camera.y + floatY + 5);
    }

    checkCollision(goat) {
        if (this.collected) return false;
        
        const distance = Math.sqrt(
            Math.pow(goat.x - this.x, 2) + 
            Math.pow(goat.y - this.y, 2)
        );
        
        if (distance < (this.width / 2 + goat.width / 2)) {
            this.collected = true;
            return true;
        }
        return false;
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 30,
            color: color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - camera.y - 3, 6, 6);
    });
    ctx.globalAlpha = 1;
}

function initPlatforms() {
    platforms.length = 0;
    enemies.length = 0;
    powerUps.length = 0;
    
    platforms.push(new Platform(
        canvas.width / 2,
        canvas.height - 100,
        'NORMAL'
    ));
    
    for (let i = 1; i < 25; i++) {
        const type = i < 4 ? 'NORMAL' :
                    Math.random() < 0.6 ? 'NORMAL' : 
                    Math.random() < 0.4 ? 'BOUNCY' : 
                    Math.random() < 0.5 ? 'BREAKING' : 'MOVING';
        platforms.push(new Platform(
            Math.random() * (canvas.width - 150) + 75,
            canvas.height - i * 45,
            type
        ));
    }
}

function generateNewPlatforms() {
    const highestPlatform = Math.min(...platforms.map(p => p.y));
    
    if (highestPlatform > camera.y - 300) {
        for (let i = 0; i < 4; i++) {
            const type = Math.random() < 0.6 ? 'NORMAL' : 
                        Math.random() < 0.4 ? 'BOUNCY' : 
                        Math.random() < 0.5 ? 'BREAKING' : 'MOVING';
            
            const newY = highestPlatform - (i + 1) * 45;
            platforms.push(new Platform(
                Math.random() * (canvas.width - 150) + 75,
                newY,
                type
            ));
            
            if (Math.random() < 0.1) {
                enemies.push(new Enemy(
                    Math.random() * (canvas.width - 50) + 25,
                    newY - 40
                ));
            }
            
            if (Math.random() < 0.05) {
                const powerUpType = Math.random() < 0.5 ? 'SUPER_JUMP' : 'INVINCIBILITY';
                powerUps.push(new PowerUp(
                    Math.random() * (canvas.width - 50) + 25,
                    newY - 40,
                    powerUpType
                ));
            }
        }
    }
    
    platforms = platforms.filter(p => p.y < camera.y + canvas.height + 100);
    enemies = enemies.filter(e => e.y < camera.y + canvas.height + 100);
    powerUps = powerUps.filter(p => p.y < camera.y + canvas.height + 100);
}

function updateGoat() {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        goat.velocityX = -goat.speed;
        goat.targetRotation = -0.2;
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        goat.velocityX = goat.speed;
        goat.targetRotation = 0.2;
    } else {
        goat.velocityX *= 0.8;
        goat.targetRotation = 0;
    }
    
    goat.rotation += (goat.targetRotation - goat.rotation) * 0.1;
    
    goat.x += goat.velocityX;
    
    if (goat.x < goat.width / 2) {
        goat.x = canvas.width - goat.width / 2;
    } else if (goat.x > canvas.width - goat.width / 2) {
        goat.x = goat.width / 2;
    }
    
    goat.velocityY += goat.gravity;
    goat.velocityY = Math.min(goat.velocityY, goat.maxVelocity);
    goat.y += goat.velocityY;
    
    if (goat.velocityY < -10) {
        goat.jumpSquash = 1.2;
    } else if (goat.velocityY > 10) {
        goat.jumpSquash = 0.8;
    } else {
        goat.jumpSquash += (1 - goat.jumpSquash) * 0.1;
    }
    
    goat.eyeBlink = Math.random() < 0.01 ? 10 : Math.max(0, goat.eyeBlink - 1);
    
    platforms.forEach(platform => {
        if (platform.checkCollision(goat)) {
            const jumpPower = goat.superJump ? goat.jumpPower * 1.5 : goat.jumpPower;
            goat.velocityY = jumpPower * platform.config.bounceMultiplier;
            
            if (platform.type === 'BOUNCY') {
                createParticles(platform.x, platform.y, '#00FF00');
            }
        }
    });
    
    if (!goat.invincible) {
        enemies.forEach(enemy => {
            if (enemy.checkCollision(goat)) {
                gameOver();
            }
        });
    }
    
    powerUps.forEach(powerUp => {
        if (powerUp.checkCollision(goat)) {
            if (powerUp.config.effect === 'superJump') {
                goat.superJump = true;
                goat.superJumpTime = powerUp.config.duration;
            } else if (powerUp.config.effect === 'invincible') {
                goat.invincible = true;
                goat.invincibleTime = powerUp.config.duration;
            }
        }
    });
    
    if (goat.superJumpTime > 0) {
        goat.superJumpTime -= 16;
        if (goat.superJumpTime <= 0) {
            goat.superJump = false;
        }
    }
    
    if (goat.invincibleTime > 0) {
        goat.invincibleTime -= 16;
        if (goat.invincibleTime <= 0) {
            goat.invincible = false;
        }
    }
    
    if (goat.y < camera.y + 200) {
        camera.y = goat.y - 200;
    }
    
    const currentScore = Math.max(0, Math.floor(-(goat.y - canvas.height + 150) / 10));
    if (currentScore > score) {
        score = currentScore;
    }
    
    if (goat.y > camera.y + canvas.height + 50) {
        gameOver();
    }
}

function drawGoat() {
    ctx.save();
    ctx.translate(goat.x, goat.y - camera.y);
    ctx.rotate(goat.rotation);
    ctx.scale(1 / goat.jumpSquash, goat.jumpSquash);
    
    if (goat.invincible) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, goat.width / 2 + 10, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    if (goat.superJump) {
        ctx.fillStyle = '#FF00FF';
        for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = 0.3 - i * 0.1;
            ctx.fillRect(-goat.width / 2, goat.height / 2 + i * 5, goat.width, 3);
        }
    }
    
    ctx.globalAlpha = 1;
    
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(-goat.width / 2, -goat.height / 2, goat.width, goat.height);
    
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(-goat.width / 2, -goat.height / 2, goat.width, 5);
    ctx.fillRect(-goat.width / 2, goat.height / 2 - 5, goat.width, 5);
    
    if (goat.eyeBlink > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(-12, -7, 6, 1);
        ctx.fillRect(6, -7, 6, 1);
    } else {
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(-8, -5, 5, 0, Math.PI * 2);
        ctx.arc(8, -5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-8 + goat.velocityX * 0.5, -5, 3, 0, Math.PI * 2);
        ctx.arc(8 + goat.velocityX * 0.5, -5, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = '#FFB6C1';
    ctx.fillRect(-5, 8, 10, 5);
    ctx.fillStyle = '#333';
    ctx.fillRect(-2, 9, 1, 3);
    ctx.fillRect(1, 9, 1, 3);
    
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(-15, -goat.height / 2);
    ctx.lineTo(-12, -goat.height / 2 - 8);
    ctx.lineTo(-8, -goat.height / 2 - 6);
    ctx.lineTo(-5, -goat.height / 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(15, -goat.height / 2);
    ctx.lineTo(12, -goat.height / 2 - 8);
    ctx.lineTo(8, -goat.height / 2 - 6);
    ctx.lineTo(5, -goat.height / 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(-18, -3, 3, 8);
    ctx.fillRect(15, -3, 3, 8);
    
    ctx.fillStyle = '#333';
    ctx.fillRect(-goat.width / 2 - 2, goat.height / 2 - 8, 4, 8);
    ctx.fillRect(goat.width / 2 - 2, goat.height / 2 - 8, 4, 8);
    ctx.fillRect(-goat.width / 2 + 8, goat.height / 2 - 8, 4, 8);
    ctx.fillRect(goat.width / 2 - 12, goat.height / 2 - 8, 4, 8);
    
    ctx.restore();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.5, '#E0F6FF');
    gradient.addColorStop(1, '#FFE4E1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 5; i++) {
        const cloudY = (i * 150 - camera.y / 3) % (canvas.height + 100);
        ctx.beginPath();
        ctx.arc(50 + i * 80, cloudY, 30, 0, Math.PI * 2);
        ctx.arc(80 + i * 80, cloudY, 40, 0, Math.PI * 2);
        ctx.arc(110 + i * 80, cloudY, 30, 0, Math.PI * 2);
        ctx.fill();
    }
}

function updateUI() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('highScore').textContent = `Best: ${highScore}`;
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    if (gameState === 'playing') {
        
        platforms.forEach(platform => {
            platform.update();
            platform.draw();
        });
        
        enemies.forEach(enemy => {
            enemy.update();
            enemy.draw();
        });
        
        powerUps.forEach(powerUp => {
            powerUp.update();
            powerUp.draw();
        });
        
        updateParticles();
        drawParticles();
        
        updateGoat();
        drawGoat();
        
        generateNewPlatforms();
        updateUI();
        
        if (goat.superJumpTime > 0) {
            ctx.fillStyle = '#FF00FF';
            ctx.fillRect(10, 60, (goat.superJumpTime / 3000) * 100, 10);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(10, 60, 100, 10);
        }
        
        if (goat.invincibleTime > 0) {
            ctx.fillStyle = '#00FFFF';
            ctx.fillRect(10, 80, (goat.invincibleTime / 5000) * 100, 10);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(10, 80, 100, 10);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameState = 'playing';
    score = 0;
    camera.y = 0;
    particles.length = 0;
    
    goat.x = canvas.width / 2;
    goat.y = canvas.height - 150;
    goat.velocityX = 0;
    goat.velocityY = 0;
    goat.invincible = false;
    goat.invincibleTime = 0;
    goat.superJump = false;
    goat.superJumpTime = 0;
    goat.rotation = 0;
    goat.targetRotation = 0;
    goat.jumpSquash = 1;
    goat.eyeBlink = 0;
    
    initPlatforms();
    
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('controls').style.display = 'block';
}

function gameOver() {
    gameState = 'gameOver';
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('controls').style.display = 'none';
}

function restartGame() {
    startGame();
}

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    gameLoop();
});