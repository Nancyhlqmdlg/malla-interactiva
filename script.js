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

// 1) Cargo y parseo courses.txt
fetch('courses.txt')
  .then(res => res.text())
  .then(txt => {
    const lines = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    const courses = [];
    let currentYear = '', currentSem = '';

    for (const line of lines) {
      // cambio de nivel
      if (YEAR_ORDER.some(y=>new RegExp(`^${y}$`,'i').test(line))) {
        currentYear = YEAR_ORDER.find(y=>new RegExp(`^${y}$`,'i').test(line));
        continue;
      }
      // cambio de semestre
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line;
        continue;
      }
      // extraigo datos
      const name    = (line.match(/^(.+?) \(/)||[,''])[1].trim();
      const code    = (line.match(/\(código ([^)]+)\)/)||[,''])[1].trim();
      const credits = +(line.match(/\(créditos que da (\d+)/)||[,'0'])[1];
      const opensRaw= (line.match(/\(abre ([^)]+)\)/)||[,''])[1];
      const opens   = opensRaw.toLowerCase().includes('no abre') 
                        ? [] 
                        : opensRaw.split(';').map(s=>s.trim());
      const unlock  = +(line.match(/\(créditos que ocupa (\d+)/)||[,'0'])[1];

      courses.push({
        year: currentYear,
        semester: currentSem,
        name, code, credits,
        opens,
        unlockCredits: unlock,
        prerequisites: []
      });
    }

    // 2) Invierto opens → prerequisites
    courses.forEach(c =>
      c.opens.forEach(openName => {
        const target = courses.find(x=>x.name===openName);
        if (target) target.prerequisites.push(c.code);
      })
    );

    // 3) Pinto y activo interacciones
    renderByYearSem(courses);
    initInteractions(courses);
  })
  .catch(err => console.error('Error al cargar courses.txt:', err));


function renderByYearSem(courses) {
  const container = document.getElementById('grid');
  container.innerHTML = '';

  YEAR_ORDER.forEach(level => {
    const lvlCourses = courses.filter(c=>c.year===level);
    if (!lvlCourses.length) return;

    const yearSec = document.createElement('section');
    yearSec.className = 'year';
    let inner = `<h2>${level}</h2>`;

    if (SEM_MAPPING[level]) {
      inner += `<div class="year-grid"></div>`;
      yearSec.innerHTML = inner;
      const yearGrid = yearSec.querySelector('.year-grid');
      SEM_MAPPING[level].forEach(sem => {
        const semSec = document.createElement('div');
        semSec.className = 'semester';
        semSec.innerHTML = `<h3>${sem}</h3><div class="courses-grid"></div>`;
        const cg = semSec.querySelector('.courses-grid');
        lvlCourses.filter(c=>c.semester===sem)
                  .forEach(c=>createCourseCard(c,cg));
        yearGrid.appendChild(semSec);
      });
    } else {
      inner += `<div class="courses-grid-full"></div>`;
      yearSec.innerHTML = inner;
      const fullGrid = yearSec.querySelector('.courses-grid-full');
      lvlCourses.forEach(c=>createCourseCard(c, fullGrid));
    }

    container.appendChild(yearSec);
  });
}

function createCourseCard(course, parentEl) {
  const el = document.createElement('div');
  el.className = 'course locked';
  el.dataset.code = course.code;
  el.dataset.unlock = course.unlockCredits;
  el.dataset.prereqs = JSON.stringify(course.prerequisites);
  el.dataset.cred = course.credits;
  el.innerHTML = `
    <span class="code">${course.code}</span>
    <span class="name">${course.name}</span>
    <span class="cred">${course.credits} cr</span>
  `;
  el.addEventListener('click', () => toggleCourse(el));
  parentEl.appendChild(el);
}

function initInteractions(courses) {
  const credEl = document.getElementById('credits');
  let totalCredits = 0;
  const approved = new Set();

  function toggleCourse(el) {
    const code = el.dataset.code;
    if (el.classList.contains('locked')) return;

    if (approved.has(code)) {
      approved.delete(code);
      totalCredits -= +el.dataset.cred;
      el.classList.remove('approved');
    } else {
      approved.add(code);
      totalCredits += +el.dataset.cred;
      el.classList.add('approved');
    }
    credEl.textContent = `Créditos acumulados: ${totalCredits}`;
    refreshLockStates(courses, approved, totalCredits);
  }

  refreshLockStates(courses, approved, totalCredits);

  function toggleCourse(el) { /*…*/ }
}

function refreshLockStates(courses, approved, totalCredits) {
  courses.forEach(c => {
    const el = document.querySelector(`.course[data-code="${c.code}"]`);
    const okCred = totalCredits >= +el.dataset.unlock;
    const okPre  = JSON.parse(el.dataset.prereqs)
                      .every(req => approved.has(req));
    if (okCred && okPre) {
      el.classList.remove('locked');
    } else {
      el.classList.add('locked');
      if (approved.has(c.code)) {
        approved.delete(c.code);
        totalCredits -= +el.dataset.cred;
        el.classList.remove('approved');
        document.getElementById('credits').textContent =
          `Créditos acumulados: ${totalCredits}`;
      }
    }
  });
}
