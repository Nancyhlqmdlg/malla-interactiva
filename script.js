const YEAR_ORDER = [
  'Principiante',
  'Intermedio',
  'Avanzado',
  'Sexto año',
  'Séptimo año'
];
const SEM_MAPPING = {
  'Principiante': ['I Semestre','II Semestre','III Semestre','IV Semestre'],
  'Intermedio':    ['V Semestre','VI Semestre','VII Semestre'],
  'Avanzado':      ['VIII Semestre','IX Semestre','X Semestre']
};

let nameMap = {};
let showPrereqs = false;
let darkMode = false;
let approved = new Set();
let totalCredits = 0;
let maxCredits = 0;

// 1) Cargo y parseo
fetch('courses.txt')
  .then(r => r.text())
  .then(txt => {
    const lines = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    const courses = [];
    let currentYear='', currentSem='';

    for (const line of lines) {
      if (YEAR_ORDER.includes(line)) {
        currentYear = line; continue;
      }
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line; continue;
      }
      const nm = line.match(/^(.+?) \(/);
      const cm = line.match(/\(código ([^)]+)\)/);
      const cr = line.match(/\(créditos que da (\d+)/);
      const om = line.match(/\(abre ([^)]+)\)/);
      const um = line.match(/\(créditos que ocupa (\d+)/);
      if (!nm||!cm||!cr) continue;

      const name    = nm[1].trim();
      const code    = cm[1].trim();
      const credits = +cr[1];
      const opens   = om
        ? (om[1].toLowerCase().includes('no abre')
            ? [] : om[1].split(';').map(s=>s.trim()))
        : [];
      const unlock  = um ? +um[1] : 0;

      maxCredits += credits;
      courses.push({
        year: currentYear,
        semester: currentSem,
        name, code, credits,
        opens,
        unlockCredits: unlock,
        prerequisites: []
      });
    }

    // build nombre→mapa y prerequisites
    courses.forEach(c => nameMap[c.code]=c.name);
    courses.forEach(c =>
      c.opens.forEach(o => {
        const tgt = courses.find(x=>x.name===o);
        if (tgt) tgt.prerequisites.push(c.code);
      })
    );

    // renderizar y controles
    renderByYearSem(courses);
    initControls(courses);
  })
  .catch(e => console.error('courses.txt:', e));


function renderByYearSem(courses) {
  const container = document.getElementById('grid');
  container.innerHTML = '';

  YEAR_ORDER.forEach(level => {
    const lvl = courses.filter(c=>c.year===level);
    if (!lvl.length) return;

    const sec = document.createElement('section');
    sec.className = 'year';
    let html = `<h2>${level}</h2>`;

    if (SEM_MAPPING[level]) {
      html += `<div class="year-grid"></div>`;
      sec.innerHTML = html;
      const yg = sec.querySelector('.year-grid');
      SEM_MAPPING[level].forEach(sem => {
        const col = document.createElement('div');
        col.className = 'semester';
        col.innerHTML = `<h3>${sem}</h3><div class="courses-grid"></div>`;
        const cg = col.querySelector('.courses-grid');
        lvl.filter(c=>c.semester===sem)
           .forEach(c=>createCourseCard(c,cg));
        yg.appendChild(col);
      });
    } else {
      html += `<div class="courses-grid-full"></div>`;
      sec.innerHTML = html;
      const full = sec.querySelector('.courses-grid-full');
      lvl.forEach(c=>createCourseCard(c, full));
    }

    container.appendChild(sec);
  });
}

function createCourseCard(course, parent) {
  const el = document.createElement('div');
  el.className = 'course locked';
  el.dataset.code = course.code;
  el.dataset.unlock = course.unlockCredits;
  el.dataset.prereqs = JSON.stringify(course.prerequisites);
  el.dataset.cred = course.credits;
  el.innerHTML = `
    <span class="code">${course.code}</span>
    <span class="name">${course.name}</span>
    <span class="cred">${course.credits} cr</span>`;
  // tooltip prerrequisitos
  const names = course.prerequisites.map(c=>nameMap[c]||c).join(', ');
  const tip = document.createElement('span');
  tip.className = 'prereqs';
  tip.textContent = names ? 'Prerrequisitos: '+names : 'Sin prerrequisitos';
  el.appendChild(tip);

  parent.appendChild(el);
}

function initControls(courses) {
  const credEl   = document.getElementById('credits');
  const bar      = document.getElementById('progress-bar');
  const btnPre   = document.getElementById('toggle-prereqs');
  const btnReset = document.getElementById('reset');
  const btnDark  = document.getElementById('toggle-dark');

  // Toggle prerrequisitos
  btnPre.addEventListener('click', () => {
    showPrereqs = !showPrereqs;
    document.body.classList.toggle('show-prereqs', showPrereqs);
    btnPre.textContent = showPrereqs
      ? 'Ocultar prerrequisitos'
      : 'Mostrar prerrequisitos';
  });

  // Reset malla
  btnReset.addEventListener('click', () => {
    approved.clear();
    totalCredits = 0;
    document.querySelectorAll('.course').forEach(el => {
      el.classList.remove('approved');
    });
    updateUI();
  });

  // Modo oscuro
  btnDark.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark', darkMode);
    btnDark.textContent = darkMode ? 'Modo claro' : 'Modo oscuro';
  });

  // Clic en cursos
  document.querySelectorAll('.course').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('locked')) return;
      const code = el.dataset.code;
      if (approved.has(code)) {
        approved.delete(code);
        totalCredits -= +el.dataset.cred;
        el.classList.remove('approved');
      } else {
        approved.add(code);
        totalCredits += +el.dataset.cred;
        el.classList.add('approved');
      }
      updateUI();
    });
  });

  // UI inicial
  updateUI();

  function updateUI() {
    // Créditos
    credEl.textContent = `Créditos acumulados: ${totalCredits}`;
    // Progreso
    const pct = maxCredits
      ? Math.min(100, (totalCredits / maxCredits) * 100)
      : 0;
    bar.style.width = pct + '%';
    // Bloqueos (incluye I Semestre con unlock=0 y sin prereqs)
    refreshLockStates(courses);
  }
}

function refreshLockStates(courses) {
  courses.forEach(c => {
    const el = document.querySelector(`.course[data-code="${c.code}"]`);
    const okCred = totalCredits >= +el.dataset.unlock;
    const okPre  = JSON.parse(el.dataset.prereqs)
                      .every(r => approved.has(r));
    el.classList.toggle('locked', !(okCred && okPre));
  });
}
