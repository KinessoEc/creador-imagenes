import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
const IMAGES_FOLDER = './screenshots';
const API_URL = 'https://api.openai.com/v1/chat/completions';

// 🔹 Fecha y categoría
const categoria = 'exfoliante_tocobo'; // <-- cambia esto según necesidad
const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// 🔹 Limpiar texto generado por la IA
function limpiarTexto(texto) {
  return texto
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // caracteres invisibles
    .replace(/\r?\n|\r/g, ' ')             // saltos de línea
    .replace(/\s+/g, ' ')                  // múltiples espacios
    .trim();                               // espacios al inicio y fin
}

// 🔹 Agrupar imágenes en bloques de 10
function agruparPorBloques(array, tamaño) {
  const bloques = [];
  for (let i = 0; i < array.length; i += tamaño) {
    bloques.push(array.slice(i, i + tamaño));
  }
  return bloques;
}

// 🔹 Leer imagen local y convertir a base64
async function leerImagenComoBase64(filePath) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return {
    type: 'image_url',
    image_url: {
      url: `data:image/${ext};base64,${buffer.toString('base64')}`
    }
  };
}

// 🔹 Primer prompt por grupo
async function procesarGrupo(imagenes) {
  const mensaje = [
    {
      type: 'text',
      text: 'Que beneficios tenemos del tonico exfoliante facial de Tocobo'
    },
    ...imagenes
  ];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: mensaje }],
      max_tokens: 1500
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error en primer prompt: ${data.error?.message || 'Desconocido'}`);
  }

  return data.choices[0].message.content;
}

// 🔹 Segundo prompt usando todas las descripciones
async function analizarDescripciones(descripciones) {
  const prompt = `Estas son algunas descripciones de los beneficios del exfoliante marca Tocobo:\n\n${descripciones.join('\n\n')}\n\n Por favor, ayudame con 4 parrafos para blog respondiendo preguntas y tratemos de usar skincare coreano`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error HTTP:', response.status, response.statusText);
      console.error('📋 Detalles:', data);
      throw new Error(`Error en segundo análisis: ${data.error?.message || 'Desconocido'}`);
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('❌ Excepción atrapada en el segundo análisis:', error.message);
    throw error;
  }
}

// 🔹 Flujo principal
async function main() {
  const archivos = await fs.readdir(IMAGES_FOLDER);
  const rutas = archivos
    .filter(nombre => /\.(jpg|jpeg|png)$/i.test(nombre))
    .map(nombre => path.join(IMAGES_FOLDER, nombre));

  const bloques = agruparPorBloques(rutas, 10);
  const resultados = [];
  const descripcionesGeneradas = [];

  for (let i = 0; i < bloques.length; i++) {
    const grupo = bloques[i];
    console.log(`📦 Procesando grupo ${i + 1} de ${bloques.length}...`);

    const imagenesBase64 = await Promise.all(grupo.map(ruta => leerImagenComoBase64(ruta)));

    try {
      const descripcionCruda = await procesarGrupo(imagenesBase64);
      const descripcionLimpia = limpiarTexto(descripcionCruda);
      resultados.push({ grupo: i + 1, archivos: grupo, descripcion: descripcionLimpia });
      descripcionesGeneradas.push(descripcionLimpia);
    } catch (error) {
      console.error(`❌ Error en grupo ${i + 1}:`, error.message);
    }
  }

  // 🔍 Segundo análisis
  let analisisFinal = '';
  if (descripcionesGeneradas.length > 0) {
    try {
      console.log('\n🔎 Analizando descripciones generadas...');
      const resultadoCrudo = await analizarDescripciones(descripcionesGeneradas);
      analisisFinal = limpiarTexto(resultadoCrudo);
      console.log('✅ Segundo análisis completado.');
    } catch (error) {
      console.error('❌ Error en el segundo análisis:', error.message);
    }
  } else {
    console.warn('⚠️ No se generaron descripciones suficientes para el segundo análisis.');
  }

  // 💾 Guardar todo en un JSON con nombre dinámico
  const salidaFinal = {
    fecha,
    categoria,
    resultados_por_grupo: resultados,
    analisis_final: analisisFinal
  };

  const nombreArchivo = `resultados_completos_${fecha}_${categoria}.json`;
  await fs.writeFile(nombreArchivo, JSON.stringify(salidaFinal, null, 2), 'utf-8');
  console.log(`📄 Resultados guardados en ${nombreArchivo}`);
}

main();
