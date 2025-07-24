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

// Carga y parseo
fetch('courses.txt')
  .then(r => r.text())
  .then(txt => {
    const lines = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    const courses = [];
    let currentYear = '', currentSem = '';

    for (const line of lines) {
      if (YEAR_ORDER.includes(line)) {
        currentYear = line; continue;
      }
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line; continue;
      }
      const mName = line.match(/^(.+?) \(/);
      const mCode = line.match(/\(código ([^)]+)\)/);
      const mCred = line.match(/\(créditos que da (\d+)/);
      const mOp   = line.match(/\(abre ([^)]+)\)/);
      const mUn   = line.match(/\(créditos que ocupa (\d+)/);
      if (!mName||!mCode||!mCred) continue;

      const name    = mName[1].trim();
      const code    = mCode[1].trim();
      const credits = +mCred[1];
      const opens   = mOp
        ? (mOp[1].toLowerCase().includes('no abre')
            ? [] : mOp[1].split(';').map(s=>s.trim()))
        : [];
      const unlock  = mUn ? +mUn[1] : 0;

      courses.push({ year: currentYear, semester: currentSem,
        name, code, credits, opens,
        unlockCredits: unlock, prerequisites: [] 
      });
    }

    // Código→nombre y suma total
    courses.forEach(c => {
      nameMap[c.code] = c.name;
      maxCredits += c.credits;
    });
    // opens→prerequisites
    courses.forEach(c =>
      c.opens.forEach(o => {
        const tgt = courses.find(x=>x.name===o);
        if (tgt) tgt.prerequisites.push(c.code);
      })
    );

    renderByYearSem(courses);
    initControls(courses);
  })
  .catch(e => console.error('courses.txt error:', e));

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
        lvl.filter(c=>c.semester===sem)
           .forEach(c=>createCourseCard(c, col.querySelector('.courses-grid')));
        yg.appendChild(col);
      });
    } else {
      html += `<div class="courses-grid-full"></div>`;
      sec.innerHTML = html;
      lvl.forEach(c=>createCourseCard(c, sec.querySelector('.courses-grid-full')));
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
  // Tooltip
  const names = course.prerequisites.map(c=>nameMap[c]||c).join(', ');
  const tip = document.createElement('span');
  tip.className = 'prereqs';
  tip.textContent = names
    ? 'Prerrequisitos: '+names
    : 'Sin prerrequisitos';
  el.appendChild(tip);

  parent.appendChild(el);
}

function initControls(courses) {
  const credEl   = document.getElementById('credits');
  const bar      = document.getElementById('progress-bar');
  const btnPre   = document.getElementById('toggle-prereqs');
  const btnReset = document.getElementById('reset');
  const btnDark  = document.getElementById('toggle-dark');

  btnPre.addEventListener('click', () => {
    showPrereqs = !showPrereqs;
    document.body.classList.toggle('show-prereqs', showPrereqs);
    btnPre.textContent = showPrereqs
      ? 'Ocultar prerrequisitos'
      : 'Mostrar prerrequisitos';
  });

  btnReset.addEventListener('click', () => {
    approved.clear();
    totalCredits = 0;
    document.querySelectorAll('.course').forEach(el=>el.classList.remove('approved'));
    updateUI();
  });

  btnDark.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark', darkMode);
    btnDark.textContent = darkMode ? 'Modo claro' : 'Modo oscuro';
  });

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

  updateUI();
}

function refreshLockStates(courses) {
  courses.forEach(c => {
    const el = document.querySelector(`.course[data-code="${c.code}"]`);
    const okCred = totalCredits >= +el.dataset.unlock;
    const okPre  = JSON.parse(el.dataset.prereqs)
                      .every(r=>approved.has(r));
    el.classList.toggle('locked', !(okCred && okPre));
  });
}

function updateUI() {
  document.getElementById('credits').textContent = `Créditos acumulados: ${totalCredits}`;
  const pct = maxCredits ? Math.min(100, totalCredits/maxCredits*100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  refreshLockStates();
}
