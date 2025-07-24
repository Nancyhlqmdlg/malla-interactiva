// 1) Cargo y parseo courses.txt
fetch('courses.txt')
  .then(r => r.text())
  .then(txt => {
    const lines = txt
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const courses = [];
    let currentYear = '';
    let currentSem = '';

    for (let line of lines) {
      // Detecto encabezados de Año
      if (/^\s*(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Séptimo) año/i.test(line)) {
        currentYear = line;
        continue;
      }
      // Detecto encabezados de Semestre
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line;
        continue;
      }

      // Extraigo datos de la línea
      const name    = (line.match(/^(.+?) \(/)       || [,''])[1].trim();
      const code    = (line.match(/\(código ([^)]+)\)/) || [,''])[1].trim();
      const credits = +(line.match(/\(créditos que da (\d+)/) || [,'0'])[1];
      const opensRaw= (line.match(/\(abre ([^)]+)\)/)  || [,''])[1];
      const opens   = opensRaw.toLowerCase().includes('no abre')
                        ? []
                        : opensRaw.split(';').map(s => s.trim());
      const unlock  = +(line.match(/\(créditos que ocupa (\d+)/) || [,'0'])[1];

      courses.push({
        year: currentYear,
        semester: currentSem,
        name,
        code,
        credits,
        opens,
        unlockCredits: unlock,
        prerequisites: []
      });
    }

    // 2) Construyo prerrequisitos invirtiendo opens
    courses.forEach(c =>
      c.opens.forEach(openName => {
        const target = courses.find(x => x.name === openName);
        if (target) target.prerequisites.push(c.code);
      })
    );

    // 3) Renderizo la malla
    renderByYearSem(courses);
    initInteractions(courses);
  })
  .catch(err => console.error('Error cargando courses.txt:', err));


// Render por año y semestre
function renderByYearSem(courses) {
  const container = document.getElementById('grid');
  container.innerHTML = '';

  const years = [...new Set(courses.map(c => c.year))];
  years.forEach(year => {
    const yearSec = document.createElement('section');
    yearSec.className = 'year';
    yearSec.innerHTML = `<h2>${year}</h2>`;
    
    const sems = [...new Set(
      courses.filter(c => c.year === year).map(c => c.semester)
    )];
    sems.forEach(sem => {
      const semSec = document.createElement('section');
      semSec.className = 'semester';
      semSec.innerHTML = `<h3>${sem}</h3><div class="grid"></div>`;
      yearSec.appendChild(semSec);

      courses
        .filter(c => c.year === year && c.semester === sem)
        .forEach(c => createCourseCard(c, semSec.querySelector('.grid')));
    });

    container.appendChild(yearSec);
  });
}

// Crea la tarjeta de cada curso
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
  parentEl.appendChild(el);
}

// Inicia la lógica de clic, créditos y desbloqueo
function initInteractions(courses) {
  const credEl = document.getElementById('credits');
  let totalCredits = 0;
  const approved = new Set();

  document.querySelectorAll('.course').forEach(el => {
    el.addEventListener('click', () => {
      const code = el.dataset.code;
      if (el.classList.contains('locked')) return;

      // Toggle aprobado
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

// Refresca locked/unlocked tras cada cambio
function refreshLockStates(courses, approved, totalCredits) {
  courses.forEach(c => {
    const el = document.querySelector(`.course[data-code="${c.code}"]`);
    const minCredOK = totalCredits >= +el.dataset.unlock;
    const prereqsOK = JSON.parse(el.dataset.prereqs)
                         .every(req => approved.has(req));

    if (minCredOK && prereqsOK) {
      el.classList.remove('locked');
    } else {
      el.classList.add('locked');
      // Si estaba aprobado pero ya no debería
      if (approved.has(c.code)) {
        approved.delete(c.code);
        totalCredits -= +el.dataset.cred;
        el.classList.remove('approved');
        document.getElementById('credits').textContent = `Créditos acumulados: ${totalCredits}`;
      }
    }
  });
}
