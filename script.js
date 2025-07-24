// Defino niveles y qué semestres van en cada uno
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

// 1) Cargar y parsear courses.txt
fetch('courses.txt')
  .then(res => res.text())
  .then(text => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const courses = [];
    let currentYear = '', currentSem = '';

    for (const line of lines) {
      // Nivel
      if (YEAR_ORDER.includes(line)) {
        currentYear = line;
        continue;
      }
      // Semestre
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line;
        continue;
      }
      // Datos de la materia
      const nameMatch = line.match(/^(.+?) \(/);
      const codeMatch = line.match(/\(código ([^)]+)\)/);
      const credMatch = line.match(/\(créditos que da (\d+)/);
      const opensMatch= line.match(/\(abre ([^)]+)\)/);
      const unlockMatch = line.match(/\(créditos que ocupa (\d+)/);

      if (!nameMatch || !codeMatch || !credMatch) continue;

      const name    = nameMatch[1].trim();
      const code    = codeMatch[1].trim();
      const credits = +credMatch[1];
      const opensRaw= opensMatch ? opensMatch[1] : '';
      const opens   = opensRaw.toLowerCase().includes('no abre')
                        ? []
                        : opensRaw.split(';').map(s=>s.trim());
      const unlock  = unlockMatch ? +unlockMatch[1] : 0;

      courses.push({
        year: currentYear,
        semester: currentSem,
        name, code, credits,
        opens,
        unlockCredits: unlock,
        prerequisites: []
      });
    }

    // 2) Invertir opens → prerequisites
    courses.forEach(c =>
      c.opens.forEach(o => {
        const target = courses.find(x => x.name === o);
        if (target) target.prerequisites.push(c.code);
      })
    );

    // 3) Render y lógica
    renderByYearSem(courses);
    initInteractions(courses);
  })
  .catch(err => console.error('Error cargando courses.txt:', err));

// Dibuja niveles y semestres
function renderByYearSem(courses) {
  const container = document.getElementById('grid');
  container.innerHTML = '';

  YEAR_ORDER.forEach(level => {
    const lvlCourses = courses.filter(c => c.year === level);
    if (!lvlCourses.length) return;

    const yearSec = document.createElement('section');
    yearSec.className = 'year';
    let html = `<h2>${level}</h2>`;

    // Si es principiante/intermedio/avanzado
    if (SEM_MAPPING[level]) {
      html += `<div class="year-grid"></div>`;
      yearSec.innerHTML = html;
      const yGrid = yearSec.querySelector('.year-grid');

      SEM_MAPPING[level].forEach(sem => {
        const semDiv = document.createElement('div');
        semDiv.className = 'semester';
        semDiv.innerHTML = `<h3>${sem}</h3><div class="courses-grid"></div>`;
        const cg = semDiv.querySelector('.courses-grid');

        lvlCourses
          .filter(c => c.semester === sem)
          .forEach(c => createCourseCard(c, cg));

        yGrid.appendChild(semDiv);
      });

    } else {
      // Sexto y Séptimo año sin semestres
      html += `<div class="courses-grid-full"></div>`;
      yearSec.innerHTML = html;
      const full = yearSec.querySelector('.courses-grid-full');
      lvlCourses.forEach(c => createCourseCard(c, full));
    }

    container.appendChild(yearSec);
  });
}

// Crea la tarjeta de cada materia (sin bind de evento)
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
    <span class="cred">${course.credits} cr</span>
  `;
  parent.appendChild(el);
}

// Inicializa clics, créditos acumulados y desbloqueos
function initInteractions(courses) {
  const credEl = document.getElementById('credits');
  let totalCredits = 0;
  const approved = new Set();

  // Asigno el evento click a todas las tarjetas
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

      credEl.textContent = `Créditos acumulados: ${totalCredits}`;
      refreshLockStates(courses, approved, totalCredits);
    });
  });

  // Primera vez
  refreshLockStates(courses, approved, totalCredits);
}

// Refresca bloqueo/desbloqueo según créditos y prerrequisitos
function refreshLockStates(courses, approved, totalCredits) {
  courses.forEach(c => {
    const sel = `.course[data-code="${c.code}"]`;
    const el = document.querySelector(sel);
    const okCred = totalCredits >= c.unlockCredits;
    const okPre  = c.prerequisites.every(r => approved.has(r));

    if (okCred && okPre) {
      el.classList.remove('locked');
    } else {
      el.classList.add('locked');
      if (approved.has(c.code)) {
        // si ya lo habías aprobado pero ya no cumple
        approved.delete(c.code);
        totalCredits -= c.credits;
        el.classList.remove('approved');
        document.getElementById('credits').textContent =
          `Créditos acumulados: ${totalCredits}`;
      }
    }
  });
}
