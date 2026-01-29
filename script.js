/* --- STATE & DATA MODEL --- */
let appData = {
    classes: {}, 
    currentClassId: null
};

// Variabler for aktiv klasse
let students = [];
let constraints = []; 
let studentAttributes = {}; 
let desks = []; 
let assignments = {}; 
let locks = {}; 
let deskCounter = 0;

// Historikk
let historyStack = [];
let redoStack = [];

// UI tilstand
let editMode = false;
let selectedIds = new Set(); 
let draggedStudent = null;

// Zoom & Pan
let viewScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStart = {x:0, y:0};

// Dragging
let isDraggingItems = false;
let isSelecting = false;
let dragStartMouse = {x:0, y:0};
let itemStartPos = {}; 
let selectionBoxStart = {x:0, y:0};

/* --- INITIALISERING --- */
document.addEventListener('DOMContentLoaded', () => {
    loadGlobalData();

    // VIKTIG: Sentrer visningen på tavla (øverst), ikke midt i rommet
    resetViewToTop();

    setupInputListeners();
    
    // Setup Scrolle/Panorere logikk
    const container = document.getElementById('classroom-container');
    container.addEventListener('mousedown', handleContainerMouseDown);
    container.addEventListener('wheel', handleWheelZoom, {passive: false}); 
    
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
});

/* --- VIEW CONTROL (NY / ENDRET) --- */

function resetViewToTop() {
    const container = document.getElementById('classroom-container');
    const cw = container.clientWidth;
    
    // 1. Sentrer Horisontalt: (ContainerBredde - CanvasBredde) / 2
    // Canvas er 2000px bredt i CSS
    panX = (cw - 2000) / 2;
    
    // 2. Start Vertikalt på toppen:
    // Vi setter den til 20px padding så tavla synes med en gang
    panY = 20;

    viewScale = 1; // Start med 100% zoom
    document.getElementById('zoomLevel').innerText = '100%';
    
    updateViewTransform();
}

function adjustZoom(delta) {
    viewScale += delta;
    if(viewScale < 0.2) viewScale = 0.2;
    if(viewScale > 3.0) viewScale = 3.0;
    updateViewTransform();
    document.getElementById('zoomLevel').innerText = Math.round(viewScale * 100) + '%';
}

function resetZoom() {
    resetViewToTop(); // Bruker den nye funksjonen her også
}

function updateViewTransform() {
    const room = document.getElementById('classroom');
    room.style.transform = `translate(${panX}px, ${panY}px) scale(${viewScale})`;
}

function handleWheelZoom(e) {
    if(e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        adjustZoom(delta);
    }
}

/* --- DATA MANAGEMENT --- */
function loadGlobalData() {
    const raw = localStorage.getItem('seatingAppPro');
    if(raw) {
        appData = JSON.parse(raw);
    } else {
        createClass("Min Klasse", true);
    }
    updateClassSelector();
    
    if(appData.currentClassId && appData.classes[appData.currentClassId]) {
        loadClass(appData.currentClassId);
    } else {
        const firstId = Object.keys(appData.classes)[0];
        if(firstId) loadClass(firstId);
    }
}

function saveGlobalData() {
    if(appData.currentClassId) {
        appData.classes[appData.currentClassId] = {
            students, constraints, studentAttributes, desks, assignments, locks, deskCounter
        };
    }
    localStorage.setItem('seatingAppPro', JSON.stringify(appData));
}

function loadClass(classId) {
    appData.currentClassId = classId;
    const data = appData.classes[classId];
    
    students = data.students || [];
    constraints = data.constraints || [];
    studentAttributes = data.studentAttributes || {};
    desks = data.desks || [];
    assignments = data.assignments || {};
    locks = data.locks || {};
    deskCounter = data.deskCounter || 0;

    document.getElementById('studentInput').value = students.join('\n');
    document.getElementById('studentListCount').innerText = `${students.length} elever`;
    document.getElementById('classSelector').value = classId;
    
    historyStack = [];
    redoStack = [];
    
    updateSelectBoxes();
    updateAttributeList();
    renderConstraints();
    renderDesks();
}

function createClass(name, isInit = false) {
    const id = name || prompt("Navn på ny klasse:");
    if(!id) return;
    if(appData.classes[id]) { alert("Finnes allerede."); return; }

    appData.classes[id] = {
        students: isInit ? ["Ola", "Kari", "Per", "Pål"] : [],
        constraints: [], studentAttributes: {}, desks: [], assignments: {}, locks: {}, deskCounter: 0
    };
    appData.currentClassId = id;
    saveGlobalData();
    updateClassSelector();
    loadClass(id);
    
    if(isInit) {
        addItem('group4'); 
        saveState();
    }
}

function deleteClass() {
    const id = appData.currentClassId;
    if(!confirm(`Slette "${id}"?`)) return;
    delete appData.classes[id];
    
    const remaining = Object.keys(appData.classes);
    if(remaining.length > 0) {
        appData.currentClassId = remaining[0];
        saveGlobalData();
        updateClassSelector();
        loadClass(remaining[0]);
    } else {
        createClass("Min Klasse", true);
    }
}

function updateClassSelector() {
    const sel = document.getElementById('classSelector');
    sel.innerHTML = '';
    Object.keys(appData.classes).forEach(id => { sel.add(new Option(id, id)); });
    sel.value = appData.currentClassId;
}

function changeClass() {
    loadClass(document.getElementById('classSelector').value);
}

function resetAllData() {
    if(confirm("Slette ALT?")) {
        localStorage.removeItem('seatingAppPro');
        location.reload();
    }
}

/* --- HISTORIKK --- */
function saveState() {
    const snapshot = JSON.stringify({ students, constraints, studentAttributes, desks, assignments, locks, deskCounter });
    if(historyStack.length > 0 && historyStack[historyStack.length-1] === snapshot) return;
    historyStack.push(snapshot);
    if(historyStack.length > 50) historyStack.shift(); 
    redoStack = []; 
    saveGlobalData(); 
}

function undo() {
    if(historyStack.length === 0) return;
    const currentSnapshot = JSON.stringify({ students, constraints, studentAttributes, desks, assignments, locks, deskCounter });
    redoStack.push(currentSnapshot);
    const prev = JSON.parse(historyStack.pop());
    applySnapshot(prev);
    saveGlobalData();
}

function redo() {
    if(redoStack.length === 0) return;
    const next = JSON.parse(redoStack.pop());
    const currentSnapshot = JSON.stringify({ students, constraints, studentAttributes, desks, assignments, locks, deskCounter });
    historyStack.push(currentSnapshot);
    applySnapshot(next);
    saveGlobalData();
}

function applySnapshot(data) {
    students = data.students; constraints = data.constraints; studentAttributes = data.studentAttributes;
    desks = data.desks; assignments = data.assignments; locks = data.locks; deskCounter = data.deskCounter;
    
    document.getElementById('studentInput').value = students.join('\n');
    document.getElementById('studentListCount').innerText = `${students.length} elever`;
    updateSelectBoxes(); updateAttributeList(); renderConstraints(); renderDesks();
}

/* --- GUI HANDLERS --- */
function addItem(type) {
    saveState(); 
    const container = document.getElementById('classroom-container');
    
    // Beregn senter av SYNLIG område for å plassere nye ting der
    const centerX = (-panX + container.clientWidth/2) / viewScale;
    const centerY = (-panY + container.clientHeight/2) / viewScale;
    
    const startX = centerX - 50; 
    const startY = centerY - 50;

    const w = 110; const h = 80;
    let offsets = [];

    if(type === 'door' || type === 'window' || type === 'obstacle') {
        offsets.push({x:0, y:0, type: type});
    } else {
        switch(type) {
            case 'single': offsets.push({x:0, y:0}); break;
            case 'pair': offsets.push({x:0, y:0}, {x:w, y:0}); break;
            case 'row4': offsets.push({x:0, y:0}, {x:w, y:0}, {x:w*2, y:0}, {x:w*3, y:0}); break;
            case 'group4': offsets.push({x:0, y:0}, {x:w, y:0}, {x:0, y:h}, {x:w, y:h}); break;
            case 'group3': offsets.push({x:0, y:0}, {x:w, y:0}, {x:w/2, y:h}); break;
            case 'horseshoe': offsets.push({x:0, y:h}, {x:0, y:0}, {x:w, y:0}, {x:w*2, y:0}, {x:w*2, y:h}); break;
        }
    }

    selectedIds.clear();
    offsets.forEach(off => {
        deskCounter++;
        const id = `item-${deskCounter}`;
        desks.push({ id: id, type: off.type || 'desk', top: startY + off.y, left: startX + off.x });
        selectedIds.add(id);
    });

    if(!editMode) {
        document.getElementById('editMode').checked = true;
        toggleEditMode();
    } else {
        renderDesks();
    }
}

function deleteSelected() {
    if(selectedIds.size === 0) return alert("Marker noe først.");
    saveState();
    selectedIds.forEach(id => { delete assignments[id]; delete locks[id]; });
    desks = desks.filter(d => !selectedIds.has(d.id));
    selectedIds.clear();
    renderDesks();
}

function clearRoom() {
    if(confirm("Tømme hele rommet?")) {
        saveState();
        desks = []; assignments = {}; locks = {}; selectedIds.clear();
        renderDesks();
    }
}

/* --- MOUSE & KEYBOARD HANDLERS --- */
let isSpacePressed = false;

function handleKeyDown(e) {
    if(e.code === 'Space' && !isSpacePressed) {
        if(e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
            e.preventDefault(); 
            isSpacePressed = true;
            document.getElementById('classroom-container').classList.add('panning');
        }
    }
    if((e.key === 'Delete' || e.key === 'Backspace') && editMode) {
        if(e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
            if(selectedIds.size > 0) { e.preventDefault(); deleteSelected(); }
        }
    }
    if((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
}

function handleKeyUp(e) {
    if(e.code === 'Space') {
        isSpacePressed = false; isPanning = false;
        document.getElementById('classroom-container').classList.remove('panning');
    }
}

function handleContainerMouseDown(e) {
    if(isSpacePressed) {
        isPanning = true; panStart = {x: e.clientX, y: e.clientY}; return;
    }
    if(editMode && (e.target.id === 'classroom-container' || e.target.id === 'classroom')) {
        if(!e.shiftKey) { selectedIds.clear(); renderDesks(); }
        isSelecting = true;
        const rect = document.getElementById('classroom').getBoundingClientRect();
        selectionBoxStart = { x: (e.clientX - rect.left) / viewScale, y: (e.clientY - rect.top) / viewScale };
        const box = document.getElementById('selection-box');
        box.style.display = 'block'; box.style.left = selectionBoxStart.x + 'px'; box.style.top = selectionBoxStart.y + 'px';
        box.style.width = '0'; box.style.height = '0';
    }
}

function handleItemMouseDown(e, id) {
    if(!editMode) return;
    e.stopPropagation(); e.preventDefault();
    if(isSpacePressed) return;

    if(e.shiftKey) {
        if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
        renderDesks();
    } else {
        if(!selectedIds.has(id)) { selectedIds.clear(); selectedIds.add(id); renderDesks(); }
    }

    isDraggingItems = true;
    dragStartMouse = {x: e.clientX, y: e.clientY};
    itemStartPos = {};
    selectedIds.forEach(itemId => {
        const d = desks.find(x => x.id === itemId);
        if(d) itemStartPos[itemId] = {top: d.top, left: d.left};
    });
}

function handleGlobalMouseMove(e) {
    if(isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panX += dx; panY += dy;
        panStart = {x: e.clientX, y: e.clientY};
        updateViewTransform(); return;
    }

    if(isDraggingItems && editMode) {
        e.preventDefault();
        const dx = (e.clientX - dragStartMouse.x) / viewScale;
        const dy = (e.clientY - dragStartMouse.y) / viewScale;

        selectedIds.forEach(id => {
            const d = desks.find(x => x.id === id);
            const start = itemStartPos[id];
            if(d && start) {
                d.left = Math.round((start.left + dx)/10)*10;
                d.top = Math.round((start.top + dy)/10)*10;
                const el = document.getElementById(id);
                if(el) { el.style.left = d.left + 'px'; el.style.top = d.top + 'px'; }
            }
        });
        return;
    }

    if(isSelecting && editMode) {
        e.preventDefault();
        const rect = document.getElementById('classroom').getBoundingClientRect();
        const currX = (e.clientX - rect.left) / viewScale;
        const currY = (e.clientY - rect.top) / viewScale;
        const x = Math.min(selectionBoxStart.x, currX); const y = Math.min(selectionBoxStart.y, currY);
        const w = Math.abs(currX - selectionBoxStart.x); const h = Math.abs(currY - selectionBoxStart.y);

        const box = document.getElementById('selection-box');
        box.style.left = x + 'px'; box.style.top = y + 'px';
        box.style.width = w + 'px'; box.style.height = h + 'px';

        desks.forEach(d => {
            const dW = (d.type === 'door' ? 80 : (d.type === 'obstacle' ? 60 : 100));
            const dH = (d.type === 'door' ? 80 : (d.type === 'obstacle' ? 60 : 60));
            const overlap = (d.left < x + w && d.left + dW > x && d.top < y + h && d.top + dH > y);
            if(overlap) selectedIds.add(d.id);
            else if(!e.shiftKey) selectedIds.delete(d.id);
        });
        renderDesks(false);
    }
}

function handleGlobalMouseUp(e) {
    if(isDraggingItems) { isDraggingItems = false; saveState(); }
    if(isSelecting) {
        isSelecting = false;
        document.getElementById('selection-box').style.display = 'none';
        renderDesks();
    }
    if(isPanning) isPanning = false;
}

/* --- RENDERING --- */
function renderDesks(fullRedraw = true) {
    if(!fullRedraw) {
        desks.forEach(d => {
            const el = document.getElementById(d.id);
            if(el) {
                if(selectedIds.has(d.id)) el.classList.add('selected'); else el.classList.remove('selected');
            }
        });
        return;
    }

    const room = document.getElementById('classroom');
    const board = room.querySelector('.board');
    const selBox = document.getElementById('selection-box');
    room.innerHTML = '';
    room.appendChild(board);
    room.appendChild(selBox);

    desks.forEach(d => {
        const el = document.createElement('div');
        el.id = d.id;
        el.className = `desk ${d.type ? 'type-'+d.type : 'type-desk'} ${selectedIds.has(d.id) ? 'selected' : ''}`;
        if(editMode) el.classList.add('moveable');
        
        el.style.top = d.top + 'px'; el.style.left = d.left + 'px';

        if(editMode) {
            el.addEventListener('mousedown', (e) => handleItemMouseDown(e, d.id));
        } else if(d.type === 'desk' || !d.type) {
            el.addEventListener('dragover', handleDragOver);
            el.addEventListener('drop', handleDropStudent);
        }

        if((d.type === 'desk' || !d.type) && assignments[d.id]) {
            const name = assignments[d.id];
            const isLocked = locks[d.id];
            const card = document.createElement('div');
            card.className = `student-card ${isLocked ? 'locked' : ''}`;
            card.innerText = name;
            card.draggable = !editMode;
            card.dataset.deskId = d.id;
            if(isLocked) card.innerHTML += ' <i class="fas fa-lock lock-icon"></i>';
            card.addEventListener('dblclick', (e) => { e.stopPropagation(); toggleLock(d.id); });
            if(!editMode) card.addEventListener('dragstart', handleDragStartStudent);
            if(editMode) card.style.pointerEvents = 'none';
            el.appendChild(card);
        }
        room.appendChild(el);
    });
}

/* --- LOGIC --- */
function parseStudents() {
    saveState();
    const raw = document.getElementById('studentInput').value;
    students = raw.split('\n').map(s => s.trim()).filter(s => s !== "");
    document.getElementById('studentListCount').innerText = `${students.length} elever`;
    updateSelectBoxes(); updateAttributeList(); saveGlobalData();
}

function updateSelectBoxes() {
    const s1 = document.getElementById('conStudent1'); const s2 = document.getElementById('conStudent2');
    if(!s1) return; s1.innerHTML = ''; s2.innerHTML = '';
    students.sort().forEach(n => { s1.add(new Option(n,n)); s2.add(new Option(n,n)); });
}
function updateAttributeList() {
    const l = document.getElementById('attributeList'); if(!l) return; l.innerHTML = '';
    students.sort().forEach(n => {
        const chk = studentAttributes[n]?.front ? 'checked' : '';
        const li = document.createElement('li');
        li.innerHTML = `${n} <input type="checkbox" ${chk} onchange="toggleAttr('${n}')">`;
        l.appendChild(li);
    });
}
function toggleAttr(n) { saveState(); if(!studentAttributes[n]) studentAttributes[n] = {}; studentAttributes[n].front = !studentAttributes[n].front; saveGlobalData(); }

function addConstraint() {
    saveState();
    const p1 = document.getElementById('conStudent1').value; const p2 = document.getElementById('conStudent2').value;
    if(p1 && p2 && p1!==p2) { constraints.push({p1, p2}); renderConstraints(); saveGlobalData(); }
}
function renderConstraints() {
    const l = document.getElementById('constraintList'); l.innerHTML = '';
    constraints.forEach((c,i) => { l.innerHTML += `<li>${c.p1} - ${c.p2} <i class="fas fa-trash" onclick="delConstraint(${i})"></i></li>`; });
}
function delConstraint(i) { saveState(); constraints.splice(i,1); renderConstraints(); saveGlobalData(); }

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
}
function toggleEditMode() { editMode = document.getElementById('editMode').checked; selectedIds.clear(); renderDesks(); }
function toggleView() { document.getElementById('classroom').classList.toggle('teacher-mode'); }

function handleDragStartStudent(e) { draggedStudent = {name: this.innerText.trim(), fromId: this.dataset.deskId}; e.dataTransfer.effectAllowed = "move"; }
function handleDragOver(e) { e.preventDefault(); if(!editMode) e.dataTransfer.dropEffect = "move"; }
function handleDropStudent(e) {
    e.preventDefault(); if(editMode) return;
    saveState();
    const targetId = this.id; const sourceId = draggedStudent.fromId;
    const tVal = assignments[targetId]; const sVal = assignments[sourceId];
    assignments[targetId] = sVal; if(tVal) assignments[sourceId] = tVal; else delete assignments[sourceId];
    renderDesks(); saveGlobalData();
}
function toggleLock(id) { saveState(); if(locks[id]) delete locks[id]; else locks[id] = true; renderDesks(); saveGlobalData(); }
function setupInputListeners() { document.getElementById('studentInput').addEventListener('change', parseStudents); }

function generateSeating() {
    saveState();
    const validDesks = desks.filter(d => !d.type || d.type === 'desk');
    let locked = []; Object.keys(locks).forEach(id => { if(assignments[id]) locked.push(assignments[id]); });
    let availableStudents = students.filter(s => !locked.includes(s));
    let availableDeskIds = validDesks.filter(d => !locks[d.id]).map(d => d.id);
    let sortableDesks = availableDeskIds.map(id => desks.find(d => d.id === id));
    sortableDesks.sort((a,b) => a.top - b.top);
    availableDeskIds.forEach(id => delete assignments[id]);
    
    let front = availableStudents.filter(s => studentAttributes[s]?.front);
    let others = availableStudents.filter(s => !studentAttributes[s]?.front);
    let bestMapping = null; let minConflicts = Infinity;
    
    for(let i=0; i<100; i++) {
        let tempAssign = {...assignments};
        shuffle(front); shuffle(others);
        let pool = [...front, ...others];
        for(let j=0; j<Math.min(pool.length, sortableDesks.length); j++) { tempAssign[sortableDesks[j].id] = pool[j]; }
        let conf = countConflicts(tempAssign);
        if(conf < minConflicts) { minConflicts = conf; bestMapping = tempAssign; }
        if(minConflicts === 0) break;
    }
    if(bestMapping) assignments = bestMapping;
    renderDesks(); saveGlobalData();
}
function countConflicts(mapping) {
    let c = 0; let sPos = {};
    for(let id in mapping) { let d = desks.find(x => x.id === id); if(d) sPos[mapping[id]] = d; }
    constraints.forEach(con => {
        let d1 = sPos[con.p1]; let d2 = sPos[con.p2];
        if(d1 && d2 && Math.hypot(d1.left-d2.left, d1.top-d2.top) < 140) c++;
    });
    return c;
}
function shuffle(a) { for(let i=a.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }}
function printClassroom() { window.print(); }
