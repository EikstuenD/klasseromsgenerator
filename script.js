/* STATE MANAGEMENT */
let students = [];
let constraints = [];
let studentAttributes = {}; 
let desks = []; 
let assignments = {}; 
let locks = {}; 

// Markering og flytting variabler
let editMode = false;
let deskCounter = 0;
let selectedDeskIds = new Set(); 

let isDraggingDesks = false;
let isSelecting = false;
let dragStartMouse = { x: 0, y: 0 };
let dragStartDeskPositions = {}; 
let selectionBoxStart = { x: 0, y: 0 };

let draggedStudent = null;

/* INITIALISERING */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('studentInput').value = "Ola\nKari\nPer\nPål\nEspen\nAskeladd\nSofie\nNora\nJakob\nEmma\nLinus\nSara";
    parseStudents();
    
    // Demo oppsett
    addPreset('group4'); 
    desks.forEach(d => { d.top += 50; d.left += 100; });
    renderDesks();

    // Lyttere for mus og tastatur
    const room = document.getElementById('classroom');
    room.addEventListener('mousedown', handleRoomMouseDown);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Lytter for Slette-tasten
    document.addEventListener('keydown', (e) => {
        if (!editMode) return; 
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedDeskIds.size > 0) {
                e.preventDefault(); 
                deleteSelectedDesks();
            }
        }
    });
});

/* 1. ELEV HÅNDTERING */
function parseStudents() {
    const raw = document.getElementById('studentInput').value;
    students = raw.split('\n').map(s => s.trim()).filter(s => s !== "");
    document.getElementById('studentListCount').innerText = `${students.length} elever registrert`;
    updateSelectBoxes();
    updateAttributeList();
}

function updateSelectBoxes() {
    const s1 = document.getElementById('conStudent1');
    const s2 = document.getElementById('conStudent2');
    s1.innerHTML = ''; s2.innerHTML = '';
    students.sort().forEach(name => {
        s1.add(new Option(name, name));
        s2.add(new Option(name, name));
    });
}

function updateAttributeList() {
    const list = document.getElementById('attributeList');
    list.innerHTML = '';
    students.sort().forEach(name => {
        const isFront = studentAttributes[name]?.front || false;
        const li = document.createElement('li');
        li.innerHTML = `${name} <label style="cursor:pointer"><input type="checkbox" ${isFront ? 'checked' : ''} onchange="toggleAttribute('${name}', 'front')"></label>`;
        list.appendChild(li);
    });
}

function toggleAttribute(name, attr) {
    if (!studentAttributes[name]) studentAttributes[name] = {};
    studentAttributes[name][attr] = !studentAttributes[name][attr];
}

/* 2. REGLER */
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    const buttons = document.querySelectorAll('.tab-btn');
    if(tabName === 'constraints') buttons[0].classList.add('active'); else buttons[1].classList.add('active');
}

function addConstraint() {
    const s1 = document.getElementById('conStudent1').value;
    const s2 = document.getElementById('conStudent2').value;
    if (s1 && s2 && s1 !== s2) {
        const exists = constraints.some(c => (c.p1 === s1 && c.p2 === s2) || (c.p1 === s2 && c.p2 === s1));
        if (!exists) { constraints.push({ p1: s1, p2: s2 }); renderConstraints(); }
    }
}

function renderConstraints() {
    const list = document.getElementById('constraintList');
    list.innerHTML = '';
    constraints.forEach((c, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${c.p1} <i class="fas fa-ban" style="color:red; margin:0 5px;"></i> ${c.p2}</span><i class="fas fa-trash" style="cursor:pointer; color:#999;" onclick="removeConstraint(${index})"></i>`;
        list.appendChild(li);
    });
}
function removeConstraint(index) { constraints.splice(index, 1); renderConstraints(); }

/* 3. MØBLERING & PULT LOGIKK */
function addDesk(top = 100, left = 100) {
    deskCounter++;
    const deskId = `desk-${deskCounter}`;
    desks.push({ id: deskId, top: top, left: left });
    return deskId;
}

function clearDesks() {
    if(confirm("Er du sikker på at du vil fjerne alle pulter?")) {
        desks = []; assignments = {}; locks = {}; selectedDeskIds.clear();
        renderDesks();
    }
}

function deleteSelectedDesks() {
    if (selectedDeskIds.size === 0) {
        alert("Marker pulter først.");
        return;
    }
    // Fjern data knyttet til pultene
    selectedDeskIds.forEach(id => {
        delete assignments[id];
        delete locks[id];
    });
    // Fjern fra listen
    desks = desks.filter(d => !selectedDeskIds.has(d.id));
    selectedDeskIds.clear();
    renderDesks();
}

function addPreset(type) {
    const startX = 250 + (Math.random() * 50);
    const startY = 150 + (Math.random() * 50);
    const w = 110; const h = 80; 
    const offsets = [];

    switch(type) {
        case 'single': offsets.push({x: 0, y: 0}); break;
        case 'pair': offsets.push({x: 0, y: 0}, {x: w, y: 0}); break;
        case 'row4': offsets.push({x: 0, y: 0}, {x: w, y: 0}, {x: w*2, y: 0}, {x: w*3, y: 0}); break;
        case 'group4': offsets.push({x: 0, y: 0}, {x: w, y: 0}, {x: 0, y: h}, {x: w, y: h}); break;
        case 'group3': offsets.push({x: 0, y: 0}, {x: w, y: 0}, {x: w/2, y: h}); break;
        case 'horseshoe': offsets.push({x: 0, y: h}, {x: 0, y: 0}, {x: w, y: 0}, {x: w*2, y: 0}, {x: w*2, y: h}); break;
    }

    selectedDeskIds.clear(); 
    offsets.forEach(offset => {
        const newId = addDesk(startY + offset.y, startX + offset.x);
        selectedDeskIds.add(newId); 
    });
    
    if(!editMode) {
        document.getElementById('editMode').checked = true;
        toggleEditMode();
    } else {
        renderDesks();
    }
}

function toggleEditMode() {
    editMode = document.getElementById('editMode').checked;
    selectedDeskIds.clear(); 
    renderDesks(); 
}

/* RENDERING */
function renderDesks() {
    const room = document.getElementById('classroom');
    const board = room.querySelector('.board');
    const selBox = document.getElementById('selection-box');
    
    room.innerHTML = '';
    room.appendChild(board);
    if(selBox) room.appendChild(selBox); 

    desks.forEach(desk => {
        const deskEl = document.createElement('div');
        const isSelected = selectedDeskIds.has(desk.id);
        
        deskEl.className = `desk ${editMode ? 'moveable' : ''} ${isSelected ? 'selected' : ''}`;
        deskEl.id = desk.id;
        deskEl.style.top = desk.top + 'px';
        deskEl.style.left = desk.left + 'px';

        if(editMode) {
            deskEl.draggable = false; 
            deskEl.addEventListener('mousedown', (e) => handleDeskMouseDown(e, desk.id));
        } else {
            deskEl.addEventListener('dragover', handleDragOver);
            deskEl.addEventListener('drop', handleDropStudent);
        }

        if (assignments[desk.id]) {
            const studentName = assignments[desk.id];
            const isLocked = locks[desk.id];
            const card = document.createElement('div');
            card.className = `student-card ${isLocked ? 'locked' : ''}`;
            
            card.draggable = !editMode;
            
            card.innerText = studentName;
            card.dataset.deskId = desk.id; 
            if(isLocked) card.innerHTML += ' <i class="fas fa-lock lock-icon"></i>';
            card.addEventListener('dblclick', (e) => { e.stopPropagation(); toggleLock(desk.id); });
            if(!editMode) card.addEventListener('dragstart', handleDragStartStudent);
            if(editMode) card.style.pointerEvents = "none";
            
            deskEl.appendChild(card);
        }
        room.appendChild(deskEl);
    });
}

/* 4. DRAG & SELECT */
function handleDeskMouseDown(e, deskId) {
    if (!editMode) return;
    
    e.preventDefault(); 
    e.stopPropagation();

    if (e.shiftKey) {
        if (selectedDeskIds.has(deskId)) {
            selectedDeskIds.delete(deskId);
        } else {
            selectedDeskIds.add(deskId);
        }
        renderDesks(); 
    } else {
        if (!selectedDeskIds.has(deskId)) {
            selectedDeskIds.clear();
            selectedDeskIds.add(deskId);
            renderDesks();
        }
    }

    isDraggingDesks = true;
    dragStartMouse = { x: e.clientX, y: e.clientY };
    dragStartDeskPositions = {};
    selectedDeskIds.forEach(id => {
        const d = desks.find(desk => desk.id === id);
        if(d) dragStartDeskPositions[id] = { top: d.top, left: d.left };
    });
}

function handleRoomMouseDown(e) {
    if (!editMode) return;
    if(e.target.id !== 'classroom') return;

    e.preventDefault();

    if (!e.shiftKey) {
        selectedDeskIds.clear();
        renderDesks();
    }
    
    isSelecting = true;
    const roomRect = document.getElementById('classroom').getBoundingClientRect();
    selectionBoxStart = {
        x: e.clientX - roomRect.left,
        y: e.clientY - roomRect.top
    };
    
    const boxEl = document.getElementById('selection-box');
    boxEl.style.left = selectionBoxStart.x + 'px';
    boxEl.style.top = selectionBoxStart.y + 'px';
    boxEl.style.width = '0px';
    boxEl.style.height = '0px';
    boxEl.style.display = 'block';
}

function handleGlobalMouseMove(e) {
    if (!editMode) return;

    // FLYTTING
    if (isDraggingDesks) {
        e.preventDefault(); 
        const dx = e.clientX - dragStartMouse.x;
        const dy = e.clientY - dragStartMouse.y;

        selectedDeskIds.forEach(id => {
            const deskData = desks.find(d => d.id === id);
            const startPos = dragStartDeskPositions[id];
            
            if (deskData && startPos) {
                let newLeft = startPos.left + dx;
                let newTop = startPos.top + dy;
                
                // Snap to grid
                newLeft = Math.round(newLeft / 10) * 10;
                newTop = Math.round(newTop / 10) * 10;
                
                deskData.left = newLeft;
                deskData.top = newTop;

                const el = document.getElementById(id);
                if(el) {
                    el.style.left = newLeft + 'px';
                    el.style.top = newTop + 'px';
                }
            }
        });
    }

    // MARKERING
    if (isSelecting) {
        e.preventDefault();
        const roomRect = document.getElementById('classroom').getBoundingClientRect();
        const currentX = e.clientX - roomRect.left;
        const currentY = e.clientY - roomRect.top;

        const x = Math.min(selectionBoxStart.x, currentX);
        const y = Math.min(selectionBoxStart.y, currentY);
        const w = Math.abs(currentX - selectionBoxStart.x);
        const h = Math.abs(currentY - selectionBoxStart.y);

        const boxEl = document.getElementById('selection-box');
        boxEl.style.left = x + 'px';
        boxEl.style.top = y + 'px';
        boxEl.style.width = w + 'px';
        boxEl.style.height = h + 'px';

        desks.forEach(desk => {
            const dLeft = desk.left;
            const dTop = desk.top;
            const dRight = dLeft + 100; 
            const dBottom = dTop + 60; 

            const overlap = !(dRight < x || dLeft > x + w || dBottom < y || dTop > y + h);

            if (overlap) {
                selectedDeskIds.add(desk.id);
            } else if (!e.shiftKey && !overlap) {
                 if (isSelecting && !e.shiftKey) selectedDeskIds.delete(desk.id);
            }
        });

        document.querySelectorAll('.desk').forEach(el => {
            if(selectedDeskIds.has(el.id)) el.classList.add('selected');
            else el.classList.remove('selected');
        });
    }
}

function handleGlobalMouseUp(e) {
    if(isDraggingDesks) isDraggingDesks = false;
    if(isSelecting) {
        isSelecting = false;
        document.getElementById('selection-box').style.display = 'none';
        renderDesks();
    }
}

/* 5. ELEV BYTTE OG LÅS */
function handleDragStartStudent(e) {
    draggedStudent = { name: this.innerText.trim(), fromDesk: this.dataset.deskId };
    e.dataTransfer.effectAllowed = "move";
}
function handleDragOver(e) { e.preventDefault(); if (!editMode) e.dataTransfer.dropEffect = "move"; }
function handleDropStudent(e) {
    e.preventDefault(); if (editMode) return;
    const targetDeskId = this.id;
    const sourceDeskId = draggedStudent.fromDesk;
    const targetStudent = assignments[targetDeskId];
    const sourceStudent = assignments[sourceDeskId];
    assignments[targetDeskId] = sourceStudent;
    if (targetStudent) assignments[sourceDeskId] = targetStudent; else delete assignments[sourceDeskId];
    renderDesks();
}
function toggleLock(deskId) {
    if (locks[deskId]) delete locks[deskId]; else locks[deskId] = true;
    renderDesks();
}

/* 6. GENERATOR */
function generateSeating() {
    let lockedStudents = [];
    Object.keys(locks).forEach(deskId => { if(assignments[deskId]) lockedStudents.push(assignments[deskId]); });
    let availableStudents = students.filter(s => !lockedStudents.includes(s));
    let availableDesks = desks.filter(d => !locks[d.id]);
    availableDesks.sort((a, b) => a.top - b.top);
    
    let frontStudents = availableStudents.filter(s => studentAttributes[s]?.front);
    let otherStudents = availableStudents.filter(s => !studentAttributes[s]?.front);
    availableDesks.forEach(d => delete assignments[d.id]);

    let bestAssignment = null;
    let minConflicts = Infinity;
    const ATTEMPTS = 100; 

    for (let i = 0; i < ATTEMPTS; i++) {
        let tempAssign = { ...assignments }; 
        shuffleArray(frontStudents); shuffleArray(otherStudents);
        let pool = [...frontStudents, ...otherStudents];
        for (let j = 0; j < Math.min(pool.length, availableDesks.length); j++) {
            tempAssign[availableDesks[j].id] = pool[j];
        }
        let conflicts = countConflicts(tempAssign);
        if (conflicts < minConflicts) { minConflicts = conflicts; bestAssignment = tempAssign; }
        if(minConflicts === 0) break; 
    }
    if(bestAssignment) assignments = bestAssignment;
    renderDesks();
}
function countConflicts(currAssign) {
    let count = 0;
    let sToD = {};
    for (const [did, name] of Object.entries(currAssign)) { sToD[name] = desks.find(d => d.id === did); }
    constraints.forEach(c => {
        const d1 = sToD[c.p1]; const d2 = sToD[c.p2];
        if (d1 && d2) {
            const dist = Math.sqrt(Math.pow(d1.left - d2.left, 2) + Math.pow(d1.top - d2.top, 2));
            if (dist < 140) count++;
        }
    });
    return count;
}
function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
function printClassroom() { window.print(); }
