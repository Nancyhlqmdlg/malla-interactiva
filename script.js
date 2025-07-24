// Orden fijo de niveles
const YEAR_ORDER = [
  'Principiante',
  'Intermedio',
  'Avanzado',
  'Sexto año',
  'Séptimo año'
];

// 1) Cargo y parseo el TXT
fetch('courses.txt')
  .then(res => res.text())
  .then(txt => {
    const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
    const courses = [];
    let currentYear = '', currentSem = '';

    for (const line of lines) {
      // Detecto nivel (Principiante, Intermedio, ...)
      if (YEAR_ORDER.some(y => new RegExp(`^${y}$`, 'i').test(line))) {
        currentYear = YEAR_ORDER.find(y => new RegExp(`^${y}$`, 'i').test(line));
        continue;
      }
      // Detecto semestre
      if (/I{1,3} Semestre|IV Semestre|V Semestre|VI Semestre|VII Semestre|VIII Semestre|IX Semestre|X Semestre/.test(line)) {
        currentSem = line;
        continue;
      }
      // Extraigo datos del curso
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
        name, code, credits,
        opens,
        unlockCredits: unlock,
        prerequisites: []
      });
    }

    // 2) Invierto opens → prerequisites
    courses.forEach(c =>
      c.opens.forEach(openName => {
        const target = courses.find(x => x.name === openName);
        if (target) target.prerequisites.push(c.code);
      })
    );

    // 3) Pinto y activo la lógica
    renderByYearSem(courses);
    initInteractions(courses);
  })
  .catch(err => console.error('Error al cargar courses.txt:', err));


// Dibuja todos los niveles en el orden YEAR_ORDER
function renderByYearSem(courses) {
  const container = document.getElementById('grid');
  container.innerHTML = '';

  YEAR_ORDER.forEach(level => {
    const lvlCourses = courses.filter(c => c.year ===
