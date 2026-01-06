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
    // Legg til noen eksempler
    document.getElementById('studentInput').value = "Ola\nKari\nPer\nPål\nEspen\nAskeladd\nSofie\nNora";
    parseStudents();
    layoutGrid(2); // Start med 2 og 2
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
            <input type="checkbox" ${isFront ? 'checked' : ''} 
            onchange="toggleAttribute('${name}', 'front')">
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
    // Enkel CSS logikk for knapper kan legges til om ønskelig
}

function addConstraint() {
    const s1 = document.getElementById('conStudent1').value;
    const s2 = document.getElementById('conStudent2').value;

    if (s1 && s2 && s1 !== s2) {
        // Sjekk om finnes
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
        li.innerHTML = `${c.p1} <i class="fas fa-ban" style="color:red"></i> ${c.p2} 
                        <i class="fas fa-trash" style="cursor:pointer" onclick="removeConstraint(${index})"></i>`;
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
    renderDesks();
}

function clearDesks() {
    if(confirm("Er du sikker på at du vil fjerne alle pulter?")) {
        desks = [];
        assignments = {};
        locks = {};
        renderDesks();
    }
}

function layoutGrid(cols) {
    desks = [];
    assignments = {};
    locks = {};
    
    // Enkle parametere for grid
    const startX = 50;
    const startY = 100;
    const gapX = 120; // Pult bredde + mellomrom
    const gapY = 80;  // Pult høyde + mellomrom
    const groupGap = 40; // Ekstra mellomrom mellom grupper

    // Beregn basert på antall elever
    const count = Math.max(students.length, 10); // Minst 10 pulter
    
    let currentRow = 0;
    let currentCol = 0;

    for (let i = 0; i < count; i++) {
        let x = startX + (currentCol * gapX);
        let y = startY + (currentRow * gapY);

        // Legg til ekstra gap for grupper (hvis cols > 1)
        if (cols > 1 && (i % cols === 0) && i !== 0) {
           // x += groupGap; // Hvis vi ville hatt horisontale grupper
        }

        addDesk(y, x); // Legger til i state

        currentCol++;
        // Hvis vi har fylt en "rad" av grupper eller nådd kanten (forenklet her)
        if (currentCol >= 6) { // Maks 6 i bredden for demo
            currentCol = 0;
            currentRow++;
        }
    }
    renderDesks();
}
/* Ny funksjon for å legge til grupper av pulter */
function addPreset(type) {
    // Startposisjon for nye grupper (midt i rommet ca, med litt tilfeldig variasjon så de ikke legger seg oppå hverandre)
    const startX = 200 + (Math.random() * 50);
    const startY = 150 + (Math.random() * 50);
    
    // Dimensjoner (Må matche CSS: width 100px, height 60px + litt luft)
    const w = 110; 
    const h = 80; 

    const offsets = [];

    switch(type) {
        case 'single':
            offsets.push({x: 0, y: 0});
            break;
            
        case 'pair':
            offsets.push({x: 0, y: 0});
            offsets.push({x: w, y: 0});
            break;

        case 'row4':
            offsets.push({x: 0, y: 0}, {x: w, y: 0}, {x: w*2, y: 0}, {x: w*3, y: 0});
            break;

        case 'group4': // 2x2 boks
            offsets.push({x: 0, y: 0}, {x: w, y: 0});
            offsets.push({x: 0, y: h}, {x: w, y: h});
            break;
            
        case 'group3': // En slags trekant/L-form
            offsets.push({x: 0, y: 0}, {x: w, y: 0});
            offsets.push({x: w/2, y: h}); // En midt under
            break;

        case 'horseshoe': // Liten hestesko på 5 pulter
            // Venstre side
            offsets.push({x: 0, y: h}, {x: 0, y: 0}); 
            // Topp/Midt
            offsets.push({x: w, y: 0});
            // Høyre side
            offsets.push({x: w*2, y: 0}, {x: w*2, y: h});
            break;
    }

    // Generer pultene basert på offsets
    offsets.forEach(offset => {
        addDesk(startY + offset.y, startX + offset.x);
    });
}
function toggleEditMode() {
    editMode = document.getElementById('editMode').checked;
    renderDesks(); // Re-render for å oppdatere cursor styles
}

/* RENDERING AV KLASSEROM */
function renderDesks() {
    const room = document.getElementById('classroom');
    // Behold Tavle, fjern pulter
    const board = room.querySelector('.board');
    room.innerHTML = '';
    room.appendChild(board);

    desks.forEach(desk => {
        const deskEl = document.createElement('div');
        deskEl.className = `desk ${editMode ? 'moveable' : ''}`;
        deskEl.id = desk.id;
        deskEl.style.top = desk.top + 'px';
        deskEl.style.left = desk.left + 'px';

        // Drag events for PULT (Innredning)
        deskEl.addEventListener('mousedown', (e) => startDragDesk(e, desk.id));
        
        // Drag events for ELEV (Swap) - Drop Zone
        deskEl.addEventListener('dragover', handleDragOver);
        deskEl.addEventListener('drop', handleDropStudent);

        // Hvis det er en elev tildelt
        if (assignments[desk.id]) {
            const studentName = assignments[desk.id];
            const isLocked = locks[desk.id];
            
            const card = document.createElement('div');
            card.className = `student-card ${isLocked ? 'locked' : ''}`;
            card.draggable = true;
            card.innerText = studentName;
            card.dataset.deskId = desk.id; // Hvor kom den fra
            
            // Legg til lås-ikon hvis låst
            if(isLocked) {
                card.innerHTML += ' <i class="fas fa-lock" style="font-size:10px; color:#f39c12"></i>';
            }

            // Klikk for å låse/låse opp
            card.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                toggleLock(desk.id);
            });

            card.addEventListener('dragstart', handleDragStartStudent);
            deskEl.appendChild(card);
        }

        room.appendChild(deskEl);
    });
}

/* 4. DRAG AND DROP - LOGIKK */

// --- Flytte Pulter (Edit Mode) ---
function startDragDesk(e, deskId) {
    if (!editMode) return;
    
    draggedDesk = desks.find(d => d.id === deskId);
    const el = document.getElementById(deskId);
    
    // Beregn offset slik at pulten ikke hopper til musepeker
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

    // Grid snap (valgfritt, gjør det penere)
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

// --- Flytte Elever (Swap) ---
function handleDragStartStudent(e) {
    draggedStudent = {
        name: this.innerText.trim(), // NB: Fjerner ikonet tekstmessig hvis textContent brukes blindt, men innerText er ok her
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

// Fjern styling når vi drar ut
document.addEventListener('dragenter', (e) => {
    if (e.target.classList && e.target.classList.contains('desk')) {
        // e.target.classList.add('drag-over');
    }
}, true);
document.addEventListener('dragleave', (e) => {
    if (e.target.classList && e.target.classList.contains('desk')) {
        e.target.classList.remove('drag-over');
    }
}, true);


function handleDropStudent(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (editMode) return; // Kan ikke bytte elever mens vi innreder

    const targetDeskId = this.id;
    const sourceDeskId = draggedStudent.fromDesk;

    // Bytt plass logic
    const studentInTarget = assignments[targetDeskId];
    const studentInSource = assignments[sourceDeskId]; // = draggedStudent.name (men cleanset for ikontekst)

    // Oppdater assignments
    assignments[targetDeskId] = assignments[sourceDeskId]; // Flytt kilde til mål
    
    if (studentInTarget) {
        assignments[sourceDeskId] = studentInTarget; // Flytt mål til kilde (swap)
    } else {
        delete assignments[sourceDeskId]; // Kilde blir tom
    }

    renderDesks();
}

function toggleLock(deskId) {
    if (locks[deskId]) {
        delete locks[deskId];
    } else {
        locks[deskId] = true;
    }
    renderDesks();
}

/* 5. GENERATOR ALGORITME */
function generateSeating() {
    // 1. Identifiser låste pulter og ledige elever
    let lockedStudents = [];
    Object.keys(locks).forEach(deskId => {
        if(assignments[deskId]) {
            lockedStudents.push(assignments[deskId]);
        }
    });

    let availableStudents = students.filter(s => !lockedStudents.includes(s));
    
    // 2. Identifiser ledige pulter
    let availableDesks = desks.filter(d => !locks[d.id]);

    // Sorter pulter: De med lavest Y (top) er "Foran"
    // Dette er viktig for "Må sitte foran" attributtet
    availableDesks.sort((a, b) => a.top - b.top);

    // 3. Plasser "Må sitte foran" elever først
    let frontStudents = availableStudents.filter(s => studentAttributes[s]?.front);
    let otherStudents = availableStudents.filter(s => !studentAttributes[s]?.front);

    // Tøm assignments for ikke-låste pulter
    availableDesks.forEach(d => delete assignments[d.id]);

    // Funksjon for å prøve å fylle opp
    // Vi kjører en enkel stokking og sjekk. 
    // For bedre resultat kunne vi kjørt dette 100 ganger og valgt den med færrest regelbrudd.
    
    let bestAssignment = null;
    let minConflicts = Infinity;

    // Prøv 50 tilfeldige kombinasjoner for å finne den beste
    for (let attempt = 0; attempt < 50; attempt++) {
        let tempAssign = { ...assignments }; // Start med låste
        let currentConflicts = 0;

        // Stokke listene
        shuffleArray(frontStudents);
        shuffleArray(otherStudents);

        let pool = [...frontStudents, ...otherStudents];
        let deskIndex = 0;

        // Fyll pulter
        for (let s of pool) {
            if (deskIndex < availableDesks.length) {
                tempAssign[availableDesks[deskIndex].id] = s;
                deskIndex++;
            }
        }

        // Tell konflikter (Uvenner sitter nær hverandre)
        // Definisjon av "nær": Samme bordgruppe eller naboer.
        // For enkelhets skyld: Distanse < X piksler.
        currentConflicts = countConflicts(tempAssign);

        if (currentConflicts < minConflicts) {
            minConflicts = currentConflicts;
            bestAssignment = tempAssign;
        }

        if (minConflicts === 0) break; // Perfekt!
    }

    assignments = bestAssignment;
    renderDesks();
}

function countConflicts(currentAssignments) {
    let conflictCount = 0;
    
    // Lag en mapping for rask oppslag: Navn -> PultObjekt
    let studentToDesk = {};
    Object.keys(currentAssignments).forEach(dId => {
        const student = currentAssignments[dId];
        const desk = desks.find(d => d.id === dId);
        if(student && desk) studentToDesk[student] = desk;
    });

    // Sjekk constraints
    constraints.forEach(c => {
        const d1 = studentToDesk[c.p1];
        const d2 = studentToDesk[c.p2];

        if (d1 && d2) {
            // Beregn avstand (Pythagoras)
            const dist = Math.sqrt(Math.pow(d1.left - d2.left, 2) + Math.pow(d1.top - d2.top, 2));
            // Hvis nærmere enn ca 150px (naboer)
            if (dist < 150) {
                conflictCount++;
            }
        }
    });

    return conflictCount;
}

// Hjelpefunksjon: Fisher-Yates shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function printClassroom() {
    window.print();
}
