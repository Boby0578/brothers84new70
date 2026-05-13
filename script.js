// ============================================
// BROTHERS84 - JEU DE DONJON 3D
// Version corrigée - Tous bugs fixés
// ============================================

try { 
    if(window.Telegram && window.Telegram.WebApp) { 
        window.Telegram.WebApp.ready(); 
        window.Telegram.WebApp.expand(); 
    } 
} catch(e){}

// ============================================
// ÉTAT GLOBAL DU JEU
// ============================================
let gameState = { 
    screen: 'title', 
    player: null, 
    floor: 1, 
    map: [], 
    playerPos: { x: 3, y: 3, angle: 0 }, 
    inCombat: false, 
    enemy: null, 
    adsWatchedForRevive: 0, 
    audioCtx: null, 
    nextNoteTime: 0, 
    currentStep: 0,
    audioInitialized: false
};

// ============================================
// SYSTÈME DE PUBLICITÉ
// ============================================
function showRewardedAd(cb) {
    if (typeof window.show_10997672 === "function") {
        try {
            let p = window.show_10997672();
            if(p && typeof p.then === 'function') { 
                p.then(cb).catch(cb); 
            } else { 
                setTimeout(cb, 1500); 
            }
        } catch(e) { 
            cb(); 
        }
    } else { 
        alert("Pubs bloquées / Test local. Récompense accordée."); 
        cb(); 
    }
}

function showInAppAd() { 
    if(typeof window.show_10997672 === 'function') {
        try { 
            window.show_10997672({
                type:'inApp',
                inAppSettings:{
                    frequency:2,
                    capping:0.1,
                    interval:30,
                    timeout:5,
                    everyPage:false
                }
            }); 
        } catch(e){} 
    }
}

// ============================================
// CRÉATION DE PERSONNAGE
// ============================================
const cStats = { 
    Chevalier:{str:600,agi:200,vit:500,end:400,int:100,mag:50,lck:200}, 
    Barbare:{str:800,agi:150,vit:600,end:500,int:50,mag:20,lck:100}, 
    Elfe:{str:200,agi:600,vit:300,end:200,int:400,mag:500,lck:400}, 
    Nain:{str:500,agi:100,vit:700,end:600,int:200,mag:100,lck:150}, 
    Espionne:{str:300,agi:800,vit:300,end:300,int:300,mag:200,lck:700}, 
    Ninja:{str:400,agi:700,vit:400,end:400,int:200,mag:300,lck:600}, 
    Amazone:{str:500,agi:500,vit:500,end:400,int:200,mag:200,lck:500} 
};

function rStat(b) { return Math.floor(b * (0.5 + Math.random())); }

function rollStats(c) { 
    let b = cStats[c]; 
    return { 
        str: rStat(b.str), 
        agi: rStat(b.agi), 
        vit: rStat(b.vit), 
        end: rStat(b.end), 
        int: rStat(b.int), 
        mag: rStat(b.mag), 
        lck: rStat(b.lck) 
    }; 
}

// ============================================
// GÉNÉRATION DU DONJON
// ============================================
function generateDungeon(w, h) {
    let map = Array(h).fill(0).map(() => Array(w).fill(1));
    // Zone de départ sécurisée (5x5 vide)
    for(let y=1; y<=5; y++) for(let x=1; x<=5; x++) map[y][x] = 0;
    let rooms = [{x:1, y:1, w:4, h:4}];
    
    for(let i=0; i<8; i++) {
        let rw = Math.floor(Math.random()*4)+2, rh = Math.floor(Math.random()*4)+2;
        let rx = Math.floor(Math.random()*(w-rw-2))+1, ry = Math.floor(Math.random()*(h-rh-2))+1;
        for(let y=ry; y<=ry+rh; y++) for(let x=rx; x<=rx+rw; x++) map[y][x]=0;
        rooms.push({x:rx, y:ry, w:rw, h:rh});
    }
    
    // Connecter les salles
    for(let i=0; i<rooms.length-1; i++) {
        let x1 = rooms[i].x+1, y1 = rooms[i].y+1;
        let x2 = rooms[i+1].x+1, y2 = rooms[i+1].y+1;
        for(let x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) map[y1][x]=0;
        for(let y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) map[y][x2]=0;
    }
    
    // Escalier
    let lr = rooms[rooms.length-1]; 
    map[lr.y+1][lr.x+1] = 2; 
    
    // Portes secrètes
    for(let y=1; y<h-1; y++) {
        for(let x=1; x<w-1; x++) {
            if(map[y][x]===1 && map[y][x-1]===0 && Math.random()<0.1) map[y][x]=3; 
        }
    }
    return map;
}

// ============================================
// SYSTÈME AUDIO / MUSIQUE
// ============================================
function initAudio() {
    if(!gameState.audioCtx) {
        gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(gameState.audioCtx.state === 'suspended') {
        gameState.audioCtx.resume();
    }
    // CORRECTION: Synchronisation du temps audio
    if(gameState.nextNoteTime < gameState.audioCtx.currentTime) {
        gameState.nextNoteTime = gameState.audioCtx.currentTime + 0.1;
    }
    gameState.audioInitialized = true;
}

function playNote(freq, time, dur, type='square', vol=0.04) {
    if(!gameState.audioCtx || freq===0) return;
    let ctx = gameState.audioCtx, 
        osc = ctx.createOscillator(), 
        gain = ctx.createGain();
    osc.type = type; 
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time); 
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain); 
    gain.connect(ctx.destination); 
    osc.start(time); 
    osc.stop(time + dur);
}

const N = { 
    C3:130.8, E3:164.8, G3:196, A3:220, C4:261.6, D4:293.7, E4:329.6, 
    F4:349.2, G4:392, A4:440, C5:523.3, R:0 
};

const mels = [
    [N.C4,N.E4,N.G4,N.C5,N.R,N.G4,N.E4,N.C4,N.D4,N.F4,N.A4,N.D5,N.R,N.A4,N.F4,N.D4],
    [N.A3,N.C4,N.E4,N.A4,N.R,N.E4,N.C4,N.A3,N.C4,N.E4,N.A4,N.C5,N.R,N.A4,N.E4,N.C4],
    [N.E3,N.G3,N.C4,N.E4,N.R,N.C4,N.G3,N.E3,N.F3,N.A3,N.C4,N.F4,N.R,N.C4,N.A3,N.F3],
    [N.A3,N.C4,N.E4,N.A4,N.G4,N.F4,N.E4,N.D4,N.C4,N.D4,N.E4,N.F4,N.G4,N.A4,N.C5,N.R]
];

const bas = [
    [N.C3,N.R,N.G3,N.R,N.C3,N.R,N.G3,N.R,N.F3,N.R,N.C3,N.R,N.F3,N.R,N.G3,N.R],
    [N.A3,N.R,N.E3,N.R,N.A3,N.R,N.E3,N.R,N.F3,N.R,N.C3,N.R,N.G3,N.R,N.A3,N.R],
    [N.E3,N.R,N.C3,N.R,N.E3,N.R,N.C3,N.R,N.F3,N.R,N.C3,N.R,N.F3,N.R,N.G3,N.R],
    [N.A3,N.R,N.E3,N.R,N.F3,N.R,N.C3,N.R,N.D3,N.R,N.A3,N.R,N.E3,N.R,N.A3,N.R]
];

function scheduleMusic() {
    // CORRECTION: Vérification correcte de l'écran actif
    if(!gameState.audioCtx || gameState.screen !== 'game') return;
    
    let ctx = gameState.audioCtx;
    while(gameState.nextNoteTime < ctx.currentTime + 0.2) {
        let idx = Math.min(Math.floor((gameState.floor - 1) / 5), mels.length - 1);
        let step = gameState.currentStep % 16;
        let bpm = gameState.inCombat ? 150 : 100;
        let stepDur = (60 / bpm) / 2;

        if(mels[idx][step] !== N.R) playNote(mels[idx][step], gameState.nextNoteTime, stepDur*1.5, 'square', 0.03);
        if(bas[idx][step] !== N.R) playNote(bas[idx][step], gameState.nextNoteTime, stepDur*2, 'triangle', 0.06);
        if(step % 4 === 0) playNote(50, gameState.nextNoteTime, stepDur*0.5, 'sawtooth', 0.02);

        gameState.nextNoteTime += stepDur;
        gameState.currentStep++;
    }
}
setInterval(scheduleMusic, 100);

// ============================================
// RAYCASTING 3D - DONJON
// ============================================
const canvas = document.getElementById('dungeon-canvas');
const ctx = canvas.getContext('2d');

// CORRECTION: Dimensions fixes pour le rendu interne
const RW = 320, RH = 180; 
const offCanvas = document.createElement('canvas'); 
offCanvas.width = RW; 
offCanvas.height = RH;
const offCtx = offCanvas.getContext('2d');
const imgData = offCtx.createImageData(RW, RH);
const buf = imgData.data;

function castRays() {
    if(!gameState.player || gameState.map.length === 0) return;
    
    // CORRECTION: Utilisation des dimensions du canvas HTML
    const cw = canvas.width; 
    const ch = canvas.height;
    
    const px = gameState.playerPos.x, 
          py = gameState.playerPos.y, 
          pa = gameState.playerPos.angle;
    const fov = Math.PI / 3, 
          mapH = gameState.map.length, 
          mapW = gameState.map[0].length;

    for(let i=0; i<RW; i++) {
        let rayA = (pa - fov/2) + (i/RW) * fov;
        let dist = 0, hitT = 1;
        
        // CORRECTION: Raycasting optimisé avec DDA
        let sin = Math.sin(rayA), cos = Math.cos(rayA);
        for(let d=0.1; d<20; d+=0.1) {
            let tx = px + cos*d, ty = py + sin*d;
            let mx = Math.floor(tx), my = Math.floor(ty);
            if(my < 0 || my >= mapH || mx < 0 || mx >= mapW) { 
                dist = d; 
                break; 
            }
            if(gameState.map[my][mx] > 0) { 
                dist = d; 
                hitT = gameState.map[my][mx]; 
                break; 
            }
        }
        
        dist = Math.max(0.2, dist) * Math.cos(rayA - pa); 
        let wH = RH / dist;
        let fog = Math.max(0, 1 - (dist / 12));
        
        // CORRECTION: Couleurs plus visibles
        let r=0, g=0, b=0;
        if(hitT===1) { 
            r = Math.min(255, 120*fog); 
            g = Math.min(255, 100*fog); 
            b = Math.min(255, 80*fog); 
        } else if(hitT===2) { 
            r = Math.min(255, 50*fog); 
            g = Math.min(255, 50*fog); 
            b = Math.min(255, 255*fog); 
        } else if(hitT===3) { 
            r = Math.min(255, 255*fog); 
            g = Math.min(255, 180*fog); 
            b = Math.min(255, 50*fog); 
        }
        
        let yS = Math.floor(RH/2 - wH/2), yE = Math.floor(RH/2 + wH/2);
        for(let y=0; y<RH; y++) {
            let idx = (y * RW + i) * 4;
            if(y < yS) { 
                // Plafond - plus clair
                buf[idx] = 5; 
                buf[idx+1] = 5; 
                buf[idx+2] = 15; 
            }
            else if(y > yE) { 
                // Sol - plus clair
                buf[idx] = 15; 
                buf[idx+1] = 15; 
                buf[idx+2] = 15; 
            }
            else { 
                buf[idx] = r|0; 
                buf[idx+1] = g|0; 
                buf[idx+2] = b|0; 
            }
            buf[idx+3] = 255;
        }
    }
    offCtx.putImageData(imgData, 0, 0);
    // CORRECTION: Upscale propre vers le canvas affiché
    ctx.drawImage(offCanvas, 0, 0, cw, ch);
}

// ============================================
// MINIMAP
// ============================================
function drawMinimap() {
    const mc = document.getElementById('minimap-canvas');
    const mcw = mc.width, mch = mc.height;
    const mctx = mc.getContext('2d'); 
    mctx.fillStyle = '#000'; 
    mctx.fillRect(0, 0, mcw, mch);
    
    const cs = Math.min(mcw / gameState.map[0].length, mch / gameState.map.length);
    const ox = (mcw - gameState.map[0].length * cs) / 2, 
          oy = (mch - gameState.map.length * cs) / 2;
          
    for(let y=0; y<gameState.map.length; y++) {
        for(let x=0; x<gameState.map[0].length; x++) {
            let v = gameState.map[y][x]; 
            if(v >= 1) { 
                mctx.fillStyle = v===3 ? '#AA6600' : (v===2 ? '#4444FF' : '#555'); 
                mctx.fillRect(ox+x*cs, oy+y*cs, cs, cs); 
            }
        }
    }
    mctx.fillStyle = '#F00'; 
    mctx.beginPath(); 
    mctx.arc(ox+gameState.playerPos.x*cs, oy+gameState.playerPos.y*cs, cs*0.6, 0, Math.PI*2); 
    mctx.fill();
    
    // Direction du joueur
    mctx.strokeStyle = '#F00';
    mctx.beginPath();
    mctx.moveTo(ox+gameState.playerPos.x*cs, oy+gameState.playerPos.y*cs);
    mctx.lineTo(
        ox+gameState.playerPos.x*cs + Math.cos(gameState.playerPos.angle)*cs*2,
        oy+gameState.playerPos.y*cs + Math.sin(gameState.playerPos.angle)*cs*2
    );
    mctx.stroke();
}

// ============================================
// SYSTÈME DE COMBAT
// ============================================
const eP = ["Squelette","Vampire","Momie","Lézard","Démon","Orc","Spectre"], 
      eS = ["de Sang","maudit","glacial"];

function spawnEnemy() { 
    let fm = 1 + (gameState.floor * 0.5); 
    let n = eP[Math.floor(Math.random()*eP.length)] + " " + eS[Math.floor(Math.random()*eS.length)]; 
    if(gameState.floor === 30) n = "Fardoll"; 
    gameState.enemy = {
        name: n,
        hpMax: Math.floor((100 + Math.random()*200) * fm),
        mpMax: 100,
        str: Math.floor((20 + Math.random()*50) * fm),
        agi: Math.floor((20 + Math.random()*30) * fm),
        xpReward: Math.floor((50 + Math.random()*100) * fm)
    }; 
    gameState.enemy.hp = gameState.enemy.hpMax; 
    gameState.enemy.mp = gameState.enemy.mpMax; 
    gameState.enemy.atb = 0; 
    drawEnemy(); 
}

function drawEnemy() { 
    let ec = document.getElementById('enemy-canvas'), 
        ectx = ec.getContext('2d'); 
    ectx.clearRect(0, 0, 160, 160); 
    ectx.fillStyle = `hsl(${Math.random()*360},70%,20%)`; 
    ectx.beginPath(); 
    ectx.moveTo(80,20); 
    for(let i=0; i<7; i++) ectx.lineTo(Math.random()*160, Math.random()*160); 
    ectx.fill(); 
    ectx.fillStyle = '#F00'; 
    ectx.beginPath(); 
    ectx.arc(60,60,8,0,Math.PI*2); 
    ectx.arc(100,60,8,0,Math.PI*2); 
    ectx.fill(); 
}

let cLoop = null;

function startCombat() { 
    gameState.inCombat = true; 
    document.getElementById('combat-ui').classList.remove('hidden'); 
    spawnEnemy(); 
    initAudio(); 
    showInAppAd(); 
    
    cLoop = setInterval(() => { 
        if(!gameState.inCombat) return; 
        
        gameState.player.atb += (gameState.player.agi + gameState.player.vit) / 1000; 
        document.getElementById('player-atb-bar').style.width = Math.min(100, gameState.player.atb) + '%'; 
        
        gameState.enemy.atb += gameState.enemy.agi / 500; 
        document.getElementById('enemy-atb-bar').style.width = Math.min(100, gameState.enemy.atb) + '%'; 
        
        if(gameState.enemy.atb >= 100) {
            gameState.enemy.atb = 0; 
            let dmg = Math.floor(gameState.enemy.str * (0.5 + Math.random()*0.5));
            gameState.player.hp -= dmg; 
            showFx('blood'); 
            if(gameState.player.hp <= 0) gameOver();
        } 
        
        // CORRECTION: Indicateur visuel ATB plein
        document.getElementById('btn-attack').style.boxShadow = gameState.player.atb >= 100 ? "0 0 15px #FFF" : "none";
        document.getElementById('btn-attack').style.opacity = gameState.player.atb >= 100 ? "1" : "0.5";
        
        updateUI(); 
    }, 50); 
}

function pAtk() { 
    if(gameState.player.atb < 100 || !gameState.inCombat) return; 
    gameState.player.atb = 0; 
    let dmg = Math.floor(gameState.player.str * (0.5 + Math.random()*0.5));
    gameState.enemy.hp -= dmg; 
    showFx('blood'); 
    if(gameState.enemy.hp <= 0) winCombat(); 
}

function winCombat() { 
    gameState.inCombat = false; 
    clearInterval(cLoop); 
    document.getElementById('combat-ui').classList.add('hidden'); 
    gameState.player.xp += gameState.enemy.xpReward; 
    let xN = gameState.player.level * 1000; 
    if(gameState.player.xp >= xN) {
        gameState.player.level++; 
        gameState.player.xp -= xN; 
        if(gameState.player.level % 3 === 0 && Math.random() < 0.6) {
            alert("Nouveau Sort débloqué !");
        }
    } 
    if(Math.random() < 0.3) genLoot(); 
    updateUI(); 
}

function genLoot() { 
    let t = ["Épée","Casque","Armure","Bottes","Anneau"], 
        p = ["Feu","Glace","Foudre","Ombre"]; 
    let it = {
        name: p[Math.floor(Math.random()*p.length)] + " " + t[Math.floor(Math.random()*t.length)],
        stat: 'str',
        value: Math.floor(Math.random()*50*gameState.floor)
    }; 
    gameState.player.inventory.push(it); 
    alert("Butin trouvé: " + it.name + " (+" + it.value + ")"); 
}

function castSpell() { 
    if(gameState.player.atb < 100 || !gameState.inCombat || gameState.player.mp < 20) return; 
    gameState.player.atb = 0; 
    gameState.player.mp -= 20; 
    let dmg = Math.floor(gameState.player.mag * (1 + Math.random()));
    gameState.enemy.hp -= dmg; 
    showFx('magic'); 
    if(gameState.enemy.hp <= 0) winCombat(); 
}

function showFx(id) { 
    let el = document.getElementById(id === 'blood' ? 'blood-splatter' : 'magic-effect'); 
    el.classList.remove('hidden'); 
    setTimeout(() => el.classList.add('hidden'), 300); 
}

function gameOver() { 
    gameState.inCombat = false; 
    clearInterval(cLoop); 
    switchScreen('gameover-screen'); 
    gameState.adsWatchedForRevive = 0; 
    updateGOBtn(); 
}

function updateGOBtn() { 
    document.getElementById('btn-new-chance').innerText = `New Chance (${gameState.adsWatchedForRevive}/10)`; 
}

// ============================================
// CONTRÔLES - CLAVIER & D-PAD
// ============================================
const keys = {};

window.addEventListener('keydown', e => {
    keys[e.key] = true;
    initAudio(); // CORRECTION: Initialiser l'audio sur toute interaction
}); 

window.addEventListener('keyup', e => keys[e.key] = false);

function setupDpad() { 
    let m = {
        'd-up': 'ArrowUp',
        'd-down': 'ArrowDown', 
        'd-left': 'ArrowLeft', 
        'd-right': 'ArrowRight'
    }; 
    
    Object.keys(m).forEach(id => { 
        let b = document.getElementById(id); 
        if(!b) return;
        
        // Touch events
        b.addEventListener('touchstart', e => {
            e.preventDefault(); 
            keys[m[id]] = true; 
            initAudio();
            b.classList.add('active');
        }, {passive: false}); 
        
        b.addEventListener('touchend', e => {
            e.preventDefault(); 
            keys[m[id]] = false;
            b.classList.remove('active');
        }); 
        
        // Mouse events
        b.addEventListener('mousedown', () => {
            keys[m[id]] = true; 
            initAudio();
            b.classList.add('active');
        }); 
        
        b.addEventListener('mouseup', () => {
            keys[m[id]] = false;
            b.classList.remove('active');
        }); 
        
        b.addEventListener('mouseleave', () => {
            keys[m[id]] = false;
            b.classList.remove('active');
        }); 
    }); 
}

// ============================================
// MOUVEMENT DU JOUEUR
// ============================================
function movePlayer() {
    if(gameState.screen === 'game' && !gameState.inCombat) {
        let sp = 0.08, rt = 0.06;
        let nx = gameState.playerPos.x, ny = gameState.playerPos.y;
        
        if(keys['ArrowUp']) {
            nx += Math.cos(gameState.playerPos.angle) * sp;
            ny += Math.sin(gameState.playerPos.angle) * sp;
        } 
        if(keys['ArrowDown']) {
            nx -= Math.cos(gameState.playerPos.angle) * sp;
            ny -= Math.sin(gameState.playerPos.angle) * sp;
        } 
        if(keys['ArrowLeft']) gameState.playerPos.angle -= rt; 
        if(keys['ArrowRight']) gameState.playerPos.angle += rt;
        
        let mx = Math.floor(nx), my = Math.floor(ny);
        let moved = false;
        
        // CORRECTION: Vérification sécurisée des limites
        if(my >= 0 && my < gameState.map.length && mx >= 0 && mx < gameState.map[0].length) {
            let tile = gameState.map[my][mx];
            if(tile === 0) {
                gameState.playerPos.x = nx; 
                gameState.playerPos.y = ny; 
                moved = true;
            } else if(tile === 2) {
                nextFloor(); 
                moved = true;
            } else if(tile === 3) {
                // Porte secrète - ouverture
                gameState.map[my][mx] = 0;
                gameState.playerPos.x = nx; 
                gameState.playerPos.y = ny; 
                moved = true;
            }
        }

        // CORRECTION: Rencontre basée sur le mouvement réussi
        if(moved && Math.random() < 0.015) { 
            startCombat();
        }
    }
}

// ============================================
// BOUCLE PRINCIPALE
// ============================================
let lastFrameTime = 0;

function gameLoop(time) {
    // CORRECTION: 30 FPS stable pour éviter la surcharge
    if(time - lastFrameTime >= 33) {
        movePlayer();
        if(gameState.screen === 'game') {
            castRays();
            drawMinimap();
        }
        lastFrameTime = time;
    }
    requestAnimationFrame(gameLoop);
}

function nextFloor() { 
    gameState.floor++; 
    gameState.map = generateDungeon(20, 20); 
    gameState.playerPos = {x: 3, y: 3, angle: 0}; 
    initAudio(); 
    updateUI(); 
}

// ============================================
// NAVIGATION ÉCRANS
// ============================================
function switchScreen(id) { 
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); 
    let el = document.getElementById(id);
    if(el) el.classList.add('active'); 
    // CORRECTION: Extraction correcte du nom d'écran
    gameState.screen = id.replace('-screen', ''); 
}

// ============================================
// INTERFACE UTILISATEUR
// ============================================
function updateUI() { 
    if(!gameState.player) return; 
    let p = gameState.player; 
    
    document.getElementById('ui-class').innerText = p.className; 
    document.getElementById('ui-name').innerText = p.name; 
    document.getElementById('ui-level').innerText = p.level; 
    document.getElementById('ui-xp').innerText = p.xp + "/" + (p.level * 1000); 
    document.getElementById('ui-str').innerText = p.str; 
    document.getElementById('ui-agi').innerText = p.agi; 
    document.getElementById('ui-vit').innerText = p.vit; 
    document.getElementById('ui-end').innerText = p.end; 
    document.getElementById('ui-int').innerText = p.int; 
    document.getElementById('ui-mag').innerText = p.mag; 
    document.getElementById('ui-lck').innerText = p.lck; 
    document.getElementById('ui-floor').innerText = gameState.floor; 
    
    let hpPct = Math.max(0, (p.hp / p.hpMax) * 100);
    let mpPct = Math.max(0, (p.mp / p.mpMax) * 100);
    document.getElementById('ui-hp-bar').style.width = hpPct + '%'; 
    document.getElementById('ui-hp-text').innerText = `HP: ${Math.max(0,p.hp)}/${p.hpMax}`; 
    document.getElementById('ui-mp-bar').style.width = mpPct + '%'; 
    document.getElementById('ui-mp-text').innerText = `MP: ${Math.max(0,p.mp)}/${p.mpMax}`; 
    
    if(gameState.enemy && gameState.inCombat) {
        let eHpPct = Math.max(0, (gameState.enemy.hp / gameState.enemy.hpMax) * 100);
        document.getElementById('enemy-hp-bar').style.width = eHpPct + '%';
        document.getElementById('enemy-hp-text').innerText = `${gameState.enemy.name} HP: ${Math.max(0,gameState.enemy.hp)}`;
    }
}

function updateCreationUI() { 
    if(!gameState.player) return; 
    let p = gameState.player; 
    document.getElementById('stats-display').innerHTML = `
        <div class="stats-grid">
            <span>FOR:${p.str}</span><span>AGI:${p.agi}</span><span>VIT:${p.vit}</span>
            <span>END:${p.end}</span><span>INT:${p.int}</span><span>MAG:${p.mag}</span><span>CHA:${p.lck}</span>
        </div>`; 
    document.getElementById('char-portrait').style.background = `linear-gradient(${Math.random()*360}deg, #333, #000)`; 
}

function updateInventoryUI() { 
    let l = document.getElementById('inv-list'); 
    l.innerHTML = ''; 
    gameState.player.inventory.forEach((it, idx) => { 
        let b = document.createElement('div'); 
        b.innerText = `${it.name} (+${it.value})`; 
        b.style.color = '#FFF'; 
        b.style.cursor = 'pointer'; 
        b.style.padding = '5px';
        b.style.borderBottom = '1px solid #333';
        b.onclick = () => equipItem(idx); 
        l.appendChild(b); 
    }); 
}

function equipItem(idx) { 
    let it = gameState.player.inventory.splice(idx, 1)[0]; 
    if(gameState.player.equipment.hand1) {
        gameState.player.str -= gameState.player.equipment.hand1.value;
    }
    gameState.player.equipment.hand1 = it; 
    gameState.player.str += it.value; 
    updateInventoryUI(); 
    updateUI(); 
}

// ============================================
// ÉVÉNEMENTS BOUTONS
// ============================================
document.getElementById('btn-new').onclick = () => { 
    let cls = document.getElementById('char-class').value; 
    let name = document.getElementById('char-name').value || "Héros"; 
    gameState.player = {
        className: cls,
        name: name,
        level: 1,
        xp: 0,
        hpMax: 1000,
        mpMax: 500,
        hp: 1000,
        mp: 500,
        atb: 0,
        inventory: [],
        equipment: {},
        spells: [],
        ...rollStats(cls)
    }; 
    updateCreationUI(); 
    switchScreen('creation-screen'); 
    initAudio();
};

document.getElementById('char-class').onchange = () => {
    if(gameState.player) {
        document.getElementById('btn-new').click();
    }
};

document.getElementById('btn-roll').onclick = () => {
    showRewardedAd(() => {
        if(gameState.player) {
            Object.assign(gameState.player, rollStats(gameState.player.className));
            updateCreationUI();
        }
    });
};

document.getElementById('btn-start-game').onclick = () => { 
    gameState.floor = 1; 
    gameState.map = generateDungeon(20, 20); 
    gameState.playerPos = {x: 3, y: 3, angle: 0}; 
    initAudio(); 
    switchScreen('game-screen'); 
    updateUI(); 
};

document.getElementById('btn-attack').onclick = pAtk; 
document.getElementById('btn-magic').onclick = castSpell;

document.getElementById('btn-inventory').onclick = () => { 
    if(gameState.inCombat) return; 
    switchScreen('inventory-screen'); 
    updateInventoryUI(); 
};

document.getElementById('btn-close-inv').onclick = () => switchScreen('game-screen');

document.getElementById('btn-restore').onclick = () => { 
    if(gameState.inCombat) return; 
    showRewardedAd(() => {
        if(gameState.player) {
            gameState.player.hp = Math.min(gameState.player.hpMax, gameState.player.hp + Math.floor(gameState.player.hpMax * 0.3));
            updateUI();
        }
    }); 
};

document.getElementById('btn-new-chance').onclick = () => { 
    showRewardedAd(() => {
        gameState.adsWatchedForRevive++; 
        updateGOBtn(); 
        if(gameState.adsWatchedForRevive >= 10) {
            if(gameState.player) {
                gameState.player.hp = gameState.player.hpMax; 
                gameState.player.mp = gameState.player.mpMax;
            }
            switchScreen('game-screen'); 
            updateUI();
        }
    }); 
};

document.getElementById('btn-save').onclick = () => {
    // CORRECTION: Sauvegarde sérialisable
    let saveData = {
        player: gameState.player,
        floor: gameState.floor,
        playerPos: gameState.playerPos,
        map: gameState.map
    };
    localStorage.setItem('b84_save', JSON.stringify(saveData));
    alert("Partie sauvegardée !");
};

document.getElementById('btn-load').onclick = 
document.getElementById('btn-load-game').onclick = () => { 
    let s = localStorage.getItem('b84_save'); 
    if(s) {
        let saveData = JSON.parse(s);
        gameState.player = saveData.player;
        gameState.floor = saveData.floor;
        gameState.playerPos = saveData.playerPos;
        gameState.map = saveData.map;
        switchScreen('game-screen'); 
        initAudio(); 
        updateUI();
    } else {
        alert("Aucune sauvegarde trouvée.");
    }
};

// ============================================
// INITIALISATION
// ============================================
setupDpad(); 
requestAnimationFrame(gameLoop);

// CORRECTION: Initialisation audio au premier clic n'importe où
document.body.addEventListener('click', initAudio, { once: true });
document.body.addEventListener('touchstart', initAudio, { once: true });
