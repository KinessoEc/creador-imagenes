import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Configura manualmente tu categoría
const categoria = 'tocobo_exfoliante'; // <-- Cambia esto según tu necesidad
const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// Leer lista de URLs desde urls.txt
const urls = fs.readFileSync('urls.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

// Crear carpeta para guardar las capturas si no existe
const folder = './screenshots';
if (!fs.existsSync(folder)) {
  fs.mkdirSync(folder);
}

// Función para convertir la URL en nombre de archivo seguro
const sanitize = url =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .substring(0, 150); // Limita el nombre para evitar errores

// Función principal
const run = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  for (const url of urls) {
    try {
      console.log(`Capturando: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Nuevo nombre con fecha y categoría
      const filename = `${sanitize(url)}_${fecha}_${categoria}.png`;
      const filePath = path.join(folder, filename);

      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`✅ Guardado: ${filePath}`);
    } catch (err) {
      console.error(`❌ Error en ${url}: ${err.message}`);
    }
  }

  await browser.close();
};

run();
