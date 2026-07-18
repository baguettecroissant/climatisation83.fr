import fs from 'fs';
import path from 'path';

const DEPT = '83';
const MIN_POP = 2000;
const OUTPUT_FILE = path.resolve('src/data/communes.json');

async function fetchCities() {
  try {
    console.log(`Fetching communes for department ${DEPT} with population >= ${MIN_POP} and including coordinates...`);
    const response = await fetch(`https://geo.api.gouv.fr/departements/${DEPT}/communes?fields=nom,code,codesPostaux,population,centre,surface`);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Filter and map
    const filtered = data
      .filter(c => c.population >= MIN_POP)
      .map(c => {
        const cp = c.codesPostaux.find(postcode => postcode.startsWith(DEPT)) || c.codesPostaux[0];
        const slug = c.nom
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const lon = c.centre?.coordinates[0] || null;
        const lat = c.centre?.coordinates[1] || null;

        return {
          nom: c.nom,
          slug,
          codePostal: cp,
          codeInsee: c.code,
          population: c.population || 0,
          surface: c.surface || 0,
          coordinates: { lon, lat }
        };
      })
      .sort((a, b) => b.population - a.population);

    console.log(`Found ${filtered.length} communes satisfying the criteria.`);
    
    // Ensure dir exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    console.log(`Saved communes to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Error fetching cities:', error);
    process.exit(1);
  }
}

fetchCities();
