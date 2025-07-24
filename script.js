fetch('courses.txt')
  .then(r => r.text())
  .then(txt => {
    const lines = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    const courses = [];
    let currentYear = '';
    let currentSem  = '';

    for (let line of lines) {
      if (/^\s*(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Séptimo) año/i.test(line)) {
        currentYear = line;
        continue;
      }
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line;
        continue;
      }
      // parsea curso como antes
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
        unlockCredits: unlock, 
        opens, 
        prerequisites: [] 
      });
    }

    // construye prerrequisitos
    courses.forEach(c =>
      c.opens.forEach(openName => {
        const target = courses.find(x => x.name === openName);
        if (target) target.prerequisites.push(c.code);
      })
    );

    renderByYearSem(courses);
  });

function renderByYearSem(courses) {
  const container = document.getElementById('grid');
  container.innerHTML = '';

  // agrupa por año
  const years = [...new Set(courses.map(c=>c.year))];
  years.forEach(year => {
    const yearSec = document.createElement('section');
    yearSec.className = 'year';
    yearSec.innerHTML = `<h2>${year}</h2>`;
    
    // agrupa por semestre dentro de este año
    const sems = [...new Set(
      courses.filter(c=>c.year===year).map(c=>c.semester)
    )];
    sems.forEach(sem => {
      const semSec = document.createElement('section');
      semSec.className = 'semester';
      semSec.innerHTML = `<h3>${sem}</h3><div class="grid"></div>`;
      yearSec.appendChild(semSec);

      // añade cursos de este año+semestre
      courses
        .filter(c=>c.year===year && c.semester===sem)
        .forEach(c => createCourseCard(c, semSec.querySelector('.grid')));
    });

    container.appendChild(yearSec);
  });

  // … luego inyecta la lógica de aprobados, créditos y refreshLockStates …
}
