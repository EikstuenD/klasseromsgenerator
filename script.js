/* STATE MANAGEMENT */
let students = [];
let constraints = []; // { p1: "Navn", p2: "Navn" }
let studentAttributes = {}; // { "Navn": { front: true/false } }
let desks = []; // { id: 1, top: 100, left: 100 }
let assignments = {}; // { deskId: "StudentName" }
let locks = {}; // { deskId: true } (Hvis en elev er låst til en pult)

let editMode = false;
let deskCounter = 0;
let draggedStudent = null;
let draggedDesk = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

/* INITIALISERING */
document.addEventListener('DOMContentLoaded', () => {
    // Legg til noen eksempler ved start
    document.getElementById('studentInput').value = "Ola\nKari\nPer\nPål\nEspen\nAskeladd\nSofie\nNora\nJakob\nEmma";
    parseStudents();
    
    // Sett inn noen pulter for demo
    addPreset('group4'); 
    // Flytt dem litt så de ikke dekker tavla
    desks.forEach(d => { d.top += 50; d.left += 100; });
    renderDesks();
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
    s1.innerHTML = '';
    s2.innerHTML = '';
    
    students.sort().forEach(name => {
        s1.add(new Option(name, name));
        s2.add(new Option(name, name));
    });
}

function updateAttributeList() {
    const list = document.getElementById('attributeList');
    list.innerHTML = '';
    students.sort().forEach(name => {
        const li = document.createElement('li');
        const isFront = studentAttributes[name]?.front || false;
        
        li.innerHTML = `
            ${name}
            <label style="cursor:pointer">
                <input type="checkbox" ${isFront ? 'checked' : ''} 
                onchange="toggleAttribute('${name}', 'front')">
            </label>
        `;
        list.appendChild(li);
    });
}

function toggleAttribute(name, attr) {
    if (!studentAttributes[name]) studentAttributes[name] = {};
    studentAttributes[name][attr] = !studentAttributes[name][attr];
}

/* 2. BEGRENSNINGER (Constraints) */
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    // Knappestyling
    const buttons = document.querySelectorAll('.tab-btn');
    if(tabName === 'constraints') buttons[0].classList.add('active');
    else buttons[1].classList.add('active');
}

function addConstraint() {
    const s1 = document.getElementById('conStudent1').value;
    const s2 = document.getElementById('conStudent2').value;

    if (s1 && s2 && s1 !== s2) {
        const exists = constraints.some(c => 
            (c.p1 === s1 && c.p2 === s2) || (c.p1 === s2 && c.p2 === s1)
        );
        
        if (!exists) {
            constraints.push({ p1: s1, p2: s2 });
            renderConstraints();
        }
    }
}

function renderConstraints() {
    const list = document.getElementById('constraintList');
    list.innerHTML = '';
    constraints.forEach((c, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${c.p1} <i class="fas fa-ban" style="color:red; margin:0 5px;"></i> ${c.p2}</span>
            <i class="fas fa-trash" style="cursor:pointer; color:#999;" onclick="removeConstraint(${index})"></i>
        `;
        list.appendChild(li);
    });
}

function removeConstraint(index) {
    constraints.splice(index, 1);
    renderConstraints();
}

/* 3. INNREDNING OG PULTER */
function addDesk(top = 100, left = 100) {
    deskCounter++;
    const deskId = `desk-${deskCounter}`;
    desks.push({ id: deskId, top: top, left: left });
    // Ikke render her hvis vi skal legge til mange (håndteres av presets)
}

function clearDesks() {
    if(confirm("Er du sikker på at du vil fjerne alle pulter?")) {
        desks = [];
        assignments = {};
        locks = {};
        renderDesks();
    }
}

// Møbelbank logikk
function addPreset(type) {
    // Plasser litt tilfeldig i senter
    const startX = 250 + (Math.random() * 50);
    const startY = 150 + (Math.random() * 50);
    
    const w = 110; // pult bredde + luft
    const h = 80;  // pult høyde + luft

    const offsets = [];

    switch(type) {
        case 'single':
            offsets.push({x: 0, y: 0});
            break;
        case 'pair':
            offsets.push({x: 0, y: 0}, {x: w, y: 0});
            break;
        case 'row4':
            offsets.push({x: 0, y: 0}, {x: w, y: 0}, {x: w*2, y: 0}, {x: w*3, y: 0});
            break;
        case 'group4': // 2x2 boks
            offsets.push({x: 0, y: 0}, {x: w, y: 0});
            offsets.push({x: 0, y: h}, {x: w, y: h});
            break;
        case 'group3': // Trekant
            offsets.push({x: 0, y: 0}, {x: w, y: 0});
            offsets.push({x: w/2, y: h}); 
            break;
        case 'horseshoe': // Hestesko (5)
            offsets.push({x: 0, y: h}, {x: 0, y: 0}); // Venstre
            offsets.push({x: w, y: 0}); // Topp
            offsets.push({x: w*2, y: 0}, {x: w*2, y: h}); // Høyre
            break;
    }

    offsets.forEach(offset => {
        addDesk(startY + offset.y, startX + offset.x);
    });
    
    renderDesks();
    
    // Slå på edit mode automatisk så brukeren skjønner de kan flyttes
    if(!editMode) {
        document.getElementById('editMode').checked = true;
        toggleEditMode();
    }
}

function toggleEditMode() {
    editMode = document.getElementById('editMode').checked;
    renderDesks(); 
}

/* RENDERING AV KLASSEROM */
function renderDesks() {
    const room = document.getElementById('classroom');
    const board = room.querySelector('.board');
    room.innerHTML = '';
    room.appendChild(board); // Behold tavla

    desks.forEach(desk => {
        const deskEl = document.createElement('div');
        deskEl.className = `desk ${editMode ? 'moveable' : ''}`;
        deskEl.id = desk.id;
        deskEl.style.top = desk.top + 'px';
        deskEl.style.left = desk.left + 'px';

        // EVENTS
        if(editMode) {
            deskEl.addEventListener('mousedown', (e) => startDragDesk(e, desk.id));
        } else {
            // Drop zone events for elever
            deskEl.addEventListener('dragover', handleDragOver);
            deskEl.addEventListener('drop', handleDropStudent);
        }

        // VIS ELEV
        if (assignments[desk.id]) {
            const studentName = assignments[desk.id];
            const isLocked = locks[desk.id];
            
            const card = document.createElement('div');
            card.className = `student-card ${isLocked ? 'locked' : ''}`;
            
            // Kun draggable hvis ikke i edit mode
            if(!editMode) card.draggable = true;
            
            card.innerText = studentName;
            card.dataset.deskId = desk.id; 
            
            if(isLocked) {
                card.innerHTML += ' <i class="fas fa-lock lock-icon"></i>';
            }

            // Dobbeltklikk for lås
            card.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                toggleLock(desk.id);
            });

            if(!editMode) card.addEventListener('dragstart', handleDragStartStudent);
            
            deskEl.appendChild(card);
        }

        room.appendChild(deskEl);
    });
}

/* 4. DRAG AND DROP - PULTER (Innredning) */
function startDragDesk(e, deskId) {
    if (!editMode) return;
    draggedDesk = desks.find(d => d.id === deskId);
    const el = document.getElementById(deskId);
    
    const rect = el.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    document.addEventListener('mousemove', moveDesk);
    document.addEventListener('mouseup', stopDragDesk);
}

function moveDesk(e) {
    if (!draggedDesk) return;
    const room = document.getElementById('classroom').getBoundingClientRect();
    
    let newLeft = e.clientX - room.left - dragOffsetX;
    let newTop = e.clientY - room.top - dragOffsetY;

    // Grid snap (10px)
    newLeft = Math.round(newLeft / 10) * 10; 
    newTop = Math.round(newTop / 10) * 10;

    draggedDesk.left = newLeft;
    draggedDesk.top = newTop;
    
    const el = document.getElementById(draggedDesk.id);
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
}

function stopDragDesk() {
    draggedDesk = null;
    document.removeEventListener('mousemove', moveDesk);
    document.removeEventListener('mouseup', stopDragDesk);
}

/* 5. DRAG AND DROP - ELEVER (Bytte plasser) */
function handleDragStartStudent(e) {
    draggedStudent = {
        name: this.innerText.trim(), 
        fromDesk: this.dataset.deskId
    };
    e.dataTransfer.effectAllowed = "move";
}

function handleDragOver(e) {
    e.preventDefault();
    if (!editMode) {
        this.classList.add('drag-over');
        e.dataTransfer.dropEffect = "move";
    }
}

// Fjern drag-over effekt
document.addEventListener('dragleave', (e) => {
    if (e.target.classList && e.target.classList.contains('desk')) {
        e.target.classList.remove('drag-over');
    }
}, true);

function handleDropStudent(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (editMode) return; 

    const targetDeskId = this.id;
    const sourceDeskId = draggedStudent.fromDesk;

    // Swap logikk
    const targetStudent = assignments[targetDeskId];
    const sourceStudent = assignments[sourceDeskId]; 

    // Hvis destinasjon er låst og vi prøver å bytte, stopp
    // (Valgfritt: Du kan fjerne denne sjekken hvis du vil kunne tvinge bytte selv om låst)
    // if(locks[targetDeskId]) return alert("Denne pulten er låst.");

    assignments[targetDeskId] = sourceStudent;
    
    if (targetStudent) {
        assignments[sourceDeskId] = targetStudent;
    } else {
        delete assignments[sourceDeskId];
    }

    renderDesks();
}

function toggleLock(deskId) {
    if (locks[deskId]) delete locks[deskId];
    else locks[deskId] = true;
    renderDesks();
}

/* 6. GENERATOR ALGORITME */
function generateSeating() {
    // Finn låste elever
    let lockedStudents = [];
    Object.keys(locks).forEach(deskId => {
        if(assignments[deskId]) lockedStudents.push(assignments[deskId]);
    });

    let availableStudents = students.filter(s => !lockedStudents.includes(s));
    let availableDesks = desks.filter(d => !locks[d.id]);

    // Sorter pulter etter Y-koordinat (Foran = lav Y)
    availableDesks.sort((a, b) => a.top - b.top);

    let frontStudents = availableStudents.filter(s => studentAttributes[s]?.front);
    let otherStudents = availableStudents.filter(s => !studentAttributes[s]?.front);

    // Tøm assignments for ledige pulter
    availableDesks.forEach(d => delete assignments[d.id]);

    // Algoritme: Prøv mange ganger, velg den med færrest regelbrudd
    let bestAssignment = null;
    let minConflicts = Infinity;
    
    // Antall forsøk (høyere tall = smartere, men tregere)
    const ATTEMPTS = 100; 

    for (let i = 0; i < ATTEMPTS; i++) {
        let tempAssign = { ...assignments }; 
        
        shuffleArray(frontStudents);
        shuffleArray(otherStudents);

        let pool = [...frontStudents, ...otherStudents];
        
        // Fyll pultene i sortert rekkefølge (foran først)
        for (let j = 0; j < Math.min(pool.length, availableDesks.length); j++) {
            tempAssign[availableDesks[j].id] = pool[j];
        }

        let conflicts = countConflicts(tempAssign);
        if (conflicts < minConflicts) {
            minConflicts = conflicts;
            bestAssignment = tempAssign;
        }
        if(minConflicts === 0) break; 
    }

    if(bestAssignment) assignments = bestAssignment;
    renderDesks();
}

function countConflicts(currAssign) {
    let count = 0;
    // Map student -> desk
    let sToD = {};
    for (const [did, name] of Object.entries(currAssign)) {
        sToD[name] = desks.find(d => d.id === did);
    }

    constraints.forEach(c => {
        const d1 = sToD[c.p1];
        const d2 = sToD[c.p2];
        if (d1 && d2) {
            // Beregn avstand
            const dist = Math.sqrt(Math.pow(d1.left - d2.left, 2) + Math.pow(d1.top - d2.top, 2));
            // Hvis nærmere enn ca 140px (naboer)
            if (dist < 140) count++;
        }
    });
    return count;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function printClassroom() {
    window.print();
}
