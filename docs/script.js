const RENDER_URL = "https://two5-lab-collaborative.onrender.com"; // ⚠️ 用您自己的 Render URL 替换
const socket = io(RENDER_URL);
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let pc;
let dataChannel;
let isInitiator = false;
let roomName = ''; 
let roomState = {}; 
let customHistory = [];
let mySelectedTheme = 'christmas'; 

const roomArea = document.getElementById('room-area');
const canvasContainer = document.getElementById('canvas-container'); 
const assetsBar = document.getElementById('assets-bar');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');


document.addEventListener('DOMContentLoaded', () => {
    const randomRoom = 'Room-' + Math.floor(1000 + Math.random() * 9000);
    const input = document.getElementById('room-input');
    if(input) input.value = randomRoom;
});

window.enterRoom = function() {
    const input = document.getElementById('room-input');
    const themeSelect = document.getElementById('landing-theme-selector');
    
    const val = input.value.trim();
    if (!val) { alert("Please enter a Room Code!"); return; }

    roomName = val;
    mySelectedTheme = themeSelect.value; 

    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('current-room-id').innerText = `🏠 ${roomName}`;

    clearAllItems();
    loadTheme(mySelectedTheme);

    initSocketAndWebRTC();
};


const themes = {
    christmas: { bg: '#fff9d9' }, cny: { bg: '#fff9d9' }, valentine: { bg: '#fff9d9' }
};

const assetCategories = {
    furniture: ["🛋️", "🛏️", "🪑", "🚪", "🪟", "🖼️", "🪴", "🚽", "🚿", "🛁", "🪜", "🧺", "🕰️", "📺", "📻"],
    christmas: ["🎄", "🎅", "🤶", "🦌", "🍪", "🌲", "🎁", "🧦", "🕯️", "⛄", "❄️", "🧣", "🧤", "🔔", "🎶", "🌟"],
    cny: ["🧧", "🏮", "🐲", "🥟", "🍊", "🧨", "🦁", "🥢", "🍲", "🍶", "🎋", "🐎", "🫖", "🎇"],
    valentine: ["❤️", "🌹", "🍫", "🥂", "💍", "🧸", "💌", "💝", "💒", "👰", "🤵", "💋", "😘", "🎁"],
    people: ["😀", "😎", "🤠", "🥳", "🧑‍🎄", "🦸", "🦹", "🧙", "🧚", "🧛", "🧜", "💃", "🕺", "🧘", "👯", "🕴️", "👮", "👷", "💂", "🕵️", "👩‍⚕️", "👨‍🌾", "👨‍🍳", "👨‍🎤", "👨‍🏫", "👨‍🏭", "👨‍💻", "👨‍💼", "👨‍🔧", "👨‍🔬", "👨‍🎨", "👨‍🚒", "👨‍✈️", "👨‍🚀", "👨‍⚖️"],
    pets: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", "🦄", "🐎", "🦉", "🐈", "🐕", "🦖", "🦕", "🐢", "🐍", "🦎", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🦈", "🐊"],
};


function clearAllItems() {
    roomState = {};
    const items = document.querySelectorAll('.room-item');
    items.forEach(el => el.remove());
}

window.switchCategory = function(categoryKey) {
    if (!assetsBar) return;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById('btn-' + categoryKey);
    if(btn) btn.classList.add('active');
    assetsBar.innerHTML = '';

    if (categoryKey === 'custom') {
        renderCustomInputUI();
        return;
    }
    const list = assetCategories[categoryKey];
    if (list) list.forEach(emoji => createDraggableAsset(emoji));
};

function renderCustomInputUI() {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex; align-items:center; gap:10px; margin-right:20px;';
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Type in Emoji'; input.style.cssText = 'padding:8px; border-radius:8px; border:1px solid #ccc; width:120px;';
    const btn = document.createElement('button');
    btn.innerText = 'Generate'; btn.style.cssText = 'padding:8px 15px; border-radius:8px; border:none; background:#f39c12; color:white; cursor:pointer;';

    const handleAdd = () => {
        const text = input.value.trim();
        if (text) { customHistory.push(text); createDraggableAsset(text); input.value = ''; }
    };
    btn.onclick = handleAdd; input.onkeypress = (e) => { if(e.key === 'Enter') handleAdd(); };
    container.appendChild(input); container.appendChild(btn);
    const divider = document.createElement('div'); divider.style.cssText = 'width:1px; height:30px; background:#ddd; margin:0 15px;';
    assetsBar.appendChild(container); assetsBar.appendChild(divider);
    customHistory.forEach(emoji => createDraggableAsset(emoji));
}

function createDraggableAsset(emoji) {
    const div = document.createElement('div'); div.className = 'asset-item'; div.innerText = emoji; div.draggable = true;
    div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', emoji); });
    assetsBar.appendChild(div);
}

function updateCategoryTabs(currentTheme) {
    ['christmas', 'cny', 'valentine'].forEach(k => { const b = document.getElementById(`btn-${k}`); if(b) b.style.display = 'none'; });
    if (['christmas', 'cny', 'valentine'].includes(currentTheme)) {
        const b = document.getElementById(`btn-${currentTheme}`); if(b) b.style.display = 'inline-block'; window.switchCategory(currentTheme);
    } else { window.switchCategory('furniture'); }
}

function loadTheme(themeKey) {
    if (themeKey !== mySelectedTheme) {
        mySelectedTheme = themeKey; 
        sendMessage({ type: 'theme_change', theme: mySelectedTheme });
    }
    
    const theme = themes[themeKey];
    if (theme) { roomArea.style.background = theme.bg; } 
    updateCategoryTabs(themeKey);
}

canvasContainer.addEventListener('click', (e) => {
    if (e.target.id === 'canvas-container') document.querySelectorAll('.room-item.selected').forEach(el => el.classList.remove('selected'));
});

canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const emoji = e.dataTransfer.getData('text/plain');
    if (emoji) {
        const rect = canvasContainer.getBoundingClientRect();
        
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        const id = 'item_' + Date.now();
        const itemData = { id, emoji, x, y, rotation: 0, fontSize: 70 };
        updateLocalStateAndRender(id, itemData);
        sendMessage({ type: 'update_item', data: itemData });
    }
});


function updateLocalStateAndRender(id, data) {
    roomState[id] = { ...roomState[id], ...data };
    const itemData = roomState[id];
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div'); el.className = 'room-item'; el.id = id;
        el.innerHTML = `${itemData.emoji}<div class="control-handle delete-btn">×</div><div class="control-handle rotate-handle">↻</div><div class="control-handle resize-handle">↘</div>`;
        canvasContainer.appendChild(el); attachItemEvents(el, id);
    }
    el.style.left = itemData.x + '%'; el.style.top = itemData.y + '%';
    el.style.fontSize = itemData.fontSize + 'px';
    el.style.transform = `translate(-50%, -50%) rotate(${itemData.rotation}deg)`;
}

function attachItemEvents(el, id) {
    const deleteBtn = el.querySelector('.delete-btn'); 
    const rotateBtn = el.querySelector('.rotate-handle'); 
    const resizeBtn = el.querySelector('.resize-handle');
    
    el.addEventListener('mousedown', (e) => { 
        if(!e.target.classList.contains('control-handle')) { 
            e.stopPropagation(); 
            document.querySelectorAll('.room-item.selected').forEach(i => i.classList.remove('selected')); 
            el.classList.add('selected'); 
        } 
    });
    
    deleteBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); el.remove(); delete roomState[id]; 
        sendMessage({ type: 'delete_item', id: id }); 
    });
    
    el.addEventListener('mousedown', (e) => { 
        if(e.target.classList.contains('control-handle')) return; 
        
        let startX = e.clientX, startY = e.clientY; 
        const containerRect = canvasContainer.getBoundingClientRect(); 
        
        const onMove = (mv) => { 
            const dx = (mv.clientX - startX) / containerRect.width * 100; 
            const dy = (mv.clientY - startY) / containerRect.height * 100; 
            
            let newX = roomState[id].x + dx;
            let newY = roomState[id].y + dy;
            
            newX = Math.max(0, Math.min(100, newX));
            newY = Math.max(0, Math.min(100, newY));

            const newData = { x: newX, y: newY }; 
            updateLocalStateAndRender(id, newData); 
            sendMessage({ type: 'update_item', data: roomState[id] }); 
            
            startX = mv.clientX; 
            startY = mv.clientY; 
        }; 
        
        const onUp = () => { 
            window.removeEventListener('mousemove', onMove); 
            window.removeEventListener('mouseup', onUp); 
        }; 
        window.addEventListener('mousemove', onMove); 
        window.addEventListener('mouseup', onUp); 
    });
    
    rotateBtn.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        const rect = el.getBoundingClientRect(); 
        const centerX = rect.left + rect.width / 2; 
        const centerY = rect.top + rect.height / 2; 
        const onRotate = (mv) => { 
            const rad = Math.atan2(mv.clientY - centerY, mv.clientX - centerX); 
            const deg = rad * (180 / Math.PI) + 90; 
            updateLocalStateAndRender(id, { rotation: deg }); 
            sendMessage({ type: 'update_item', data: roomState[id] }); 
        }; 
        const onUp = () => { window.removeEventListener('mousemove', onRotate); window.removeEventListener('mouseup', onUp); }; 
        window.addEventListener('mousemove', onRotate); 
        window.addEventListener('mouseup', onUp); 
    });
    
    resizeBtn.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        const startY = e.clientY; 
        const startFontSize = roomState[id].fontSize; 
        const onResize = (mv) => { 
            const deltaY = mv.clientY - startY; 
            let newFontSize = startFontSize + deltaY * 0.8; 
            newFontSize = Math.max(30, Math.min(400, newFontSize)); 
            updateLocalStateAndRender(id, { fontSize: newFontSize }); 
            sendMessage({ type: 'update_item', data: roomState[id] }); 
        }; 
        const onUp = () => { window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', onUp); }; 
        window.addEventListener('mousemove', onResize); 
        window.addEventListener('mouseup', onUp); 
    });
}

function initSocketAndWebRTC() {
    socket.emit('join', roomName);

    socket.on('created', () => { isInitiator = true; updateStatus('Waiting for peer...'); });
    socket.on('joined', () => { isInitiator = false; updateStatus('Peer joined. Starting connection...'); });
    socket.on('full', () => alert('Room is full.'));
    socket.on('ready', () => { startWebRTC(); });

    socket.on('signal', async (data) => {
        if (!pc) startWebRTC();
        try {
            if (data.desc) {
                await pc.setRemoteDescription(data.desc);
                if (data.desc.type === 'offer') { const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit('signal', { room: roomName, desc: answer }); }
            } else if (data.candidate) { await pc.addIceCandidate(data.candidate); }
        } catch (err) { console.error(err); }
    });
}

function startWebRTC() {
    pc = new RTCPeerConnection(rtcConfig);
    pc.onicecandidate = (e) => e.candidate && socket.emit('signal', { room: roomName, candidate: e.candidate });
    
    pc.onconnectionstatechange = () => { 
        if (pc.connectionState === 'connected') {
            updateStatus('🟢 Connected', 'lime'); 
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            updateStatus('🟡 Peer Disconnected', 'orange');
        }
    };
    
    if (isInitiator) { 
        dataChannel = pc.createDataChannel('dataChannel'); 
        setupDataChannel(); 
        pc.createOffer().then(o => { 
            pc.setLocalDescription(o); 
            socket.emit('signal', { room: roomName, desc: o }); 
        }); 
    } else { 
        pc.ondatachannel = (e) => { 
            dataChannel = e.channel; 
            setupDataChannel(); 
        }; 
    }
}

function setupDataChannel() {
    dataChannel.onopen = () => { 
        if (!isInitiator) {
             sendMessage({ type: 'request_sync' }); 
        } 
        else if (Object.keys(roomState).length > 0) {
            sendMessage({ type: 'sync_state', state: roomState, theme: mySelectedTheme }); 
        }
    };
    dataChannel.onmessage = (e) => handleRemoteAction(JSON.parse(e.data));
    dataChannel.onclose = () => updateStatus('🔴 Peer Lost', 'red');
}

function sendMessage(msg) { if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(msg)); }

function handleRemoteAction(data) {
    switch (data.type) {
        case 'request_sync':
            if (isInitiator) {
                sendMessage({ type: 'sync_state', state: roomState, theme: mySelectedTheme });
            }
            break;
        case 'theme_change': 
            mySelectedTheme = data.theme; 
            clearAllItems();
            loadTheme(data.theme); 
            break;
        case 'update_item': updateLocalStateAndRender(data.data.id, data.data); break;
        case 'delete_item': 
            const el = document.getElementById(data.id); 
            if (el) { el.remove(); delete roomState[data.id]; } 
            break;
        case 'sync_state': 
            roomState = data.state; 
            mySelectedTheme = data.theme; 
            clearAllItems(); 
            loadTheme(mySelectedTheme);
            Object.values(roomState).forEach(item => updateLocalStateAndRender(item.id, item)); 
            break;
    }
}

function updateStatus(text, color = 'gray') { 
    if(statusText) statusText.innerText = text; 
    if(statusDot) statusDot.style.color = color; 
}


window.showShowcase = function() {
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('selected'));
    
    const showcaseOverlay = document.getElementById('showcase-overlay');
    const previewImg = document.getElementById('preview-img');

    html2canvas(canvasContainer, {
        useCORS: true,
        backgroundColor: null 
    }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/png');
        previewImg.src = dataUrl;
        showcaseOverlay.style.display = 'flex'; 
    }).catch(error => {
        console.error("Screenshot failed:", error);
        alert("Screenshot failed, please check browser permissions or try reloading.");
    });
};

window.downloadImage = function() {
    const previewImg = document.getElementById('preview-img');
    const imageURL = previewImg.src;
    
    if (!imageURL || imageURL.startsWith('data:,')) {
        alert("Please click 'Finish Creation' to generate the image preview first!");
        return;
    }
    
    const link = document.createElement('a');
    link.href = imageURL;
    link.download = `HolidayRoom_${roomName}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.closeShowcase = function() {
    document.getElementById('showcase-overlay').style.display = 'none';
};

loadTheme(mySelectedTheme);