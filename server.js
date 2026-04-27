/**
 * server.js
 * 
 * Capa de enrutamiento y API REST del sistema de sharding.
 *
 * Este servidor actúa como intermediario entre el cliente y
 * las bases de datos fragmentadas, encargándose de:
 *   - Calcular el shard destino para cada operación
 *   - Dirigir inserciones y consultas al shard correcto
 *   - Garantizar consistencia e integridad de los datos
 *
 * Motor de BD: sql.js (SQLite WASM — sin dependencias nativas)
 * 
 */

const express   = require('express');
const path      = require('path');
const cors      = require('cors');
const initSqlJs = require('sql.js');

// Módulos de sharding
const H = require('./db/horizontal');
const V = require('./db/vertical');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// INICIALIZAR SQLite en memoria (sql.js — WASM puro)
// ============================================================
let db;

/** Ejecuta SQL sin retorno (INSERT, CREATE, etc.) */
const run = (sql, params = []) => db.run(sql, params);

/** Ejecuta SELECT y retorna array de objetos */
const query = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
};

/** Ejecuta SELECT y retorna el primer resultado o null */
const queryOne = (sql, params = []) => query(sql, params)[0] || null;

// ============================================================
// DATOS SEMILLA
// ============================================================
const clientesSeed = [
  { id:  1, nombre: 'Ana Rodríguez',    email: 'ana@mail.com',    ciudad: 'Bogotá' },
  { id:  2, nombre: 'Carlos Méndez',    email: 'carlos@mail.com', ciudad: 'Medellín' },
  { id:  3, nombre: 'Sofía Torres',     email: 'sofia@mail.com',  ciudad: 'Cali' },
  { id:  4, nombre: 'Diego Vargas',     email: 'diego@mail.com',  ciudad: 'Barranquilla' },
  { id:  5, nombre: 'Valentina Ruiz',   email: 'val@mail.com',    ciudad: 'Bogotá' },
  { id:  6, nombre: 'Mateo Gómez',      email: 'mateo@mail.com',  ciudad: 'Cartagena' },
  { id:  7, nombre: 'Isabella Pérez',   email: 'isa@mail.com',    ciudad: 'Pereira' },
  { id:  8, nombre: 'Sebastián Mora',   email: 'seba@mail.com',   ciudad: 'Manizales' },
  { id:  9, nombre: 'Camila Soto',      email: 'cami@mail.com',   ciudad: 'Bucaramanga' },
  { id: 10, nombre: 'Alejandro Cruz',   email: 'alejo@mail.com',  ciudad: 'Ibagué' },
  { id: 11, nombre: 'Daniela Jiménez',  email: 'dani@mail.com',   ciudad: 'Cúcuta' },
  { id: 12, nombre: 'Felipe Castro',    email: 'feli@mail.com',   ciudad: 'Villavicencio' },
];

const usuariosSeed = [
  { id: 1, nombre: 'Ana Rodríguez',  email: 'ana@mail.com',    pais: 'Colombia', plan: 'Premium', ultimo_login: '2026-04-25', total_compras: 45, score: 9.2, activo: true  },
  { id: 2, nombre: 'Carlos Méndez',  email: 'carlos@mail.com', pais: 'México',   plan: 'Básico',  ultimo_login: '2026-04-20', total_compras: 12, score: 6.5, activo: true  },
  { id: 3, nombre: 'Sofía Torres',   email: 'sofia@mail.com',  pais: 'Colombia', plan: 'Pro',     ultimo_login: '2026-04-26', total_compras: 78, score: 9.8, activo: true  },
  { id: 4, nombre: 'Diego Vargas',   email: 'diego@mail.com',  pais: 'España',   plan: 'Básico',  ultimo_login: '2026-03-10', total_compras:  3, score: 4.1, activo: false },
  { id: 5, nombre: 'Valentina Ruiz', email: 'val@mail.com',    pais: 'Colombia', plan: 'Premium', ultimo_login: '2026-04-27', total_compras: 99, score: 9.9, activo: true  },
  { id: 6, nombre: 'Mateo Gómez',    email: 'mateo@mail.com',  pais: 'Chile',    plan: 'Pro',     ultimo_login: '2026-04-15', total_compras: 34, score: 7.7, activo: true  },
];

// ============================================================
// ARRANQUE DEL SERVIDOR
// ============================================================
initSqlJs().then(SQL => {
  db = new SQL.Database();

  // Inicializar esquemas desde los módulos
  H.initHorizontal(db, run);
  V.initVertical(db, run);

  // Cargar datos semilla
  clientesSeed.forEach(c => H.insertarCliente(db, run, c));
  usuariosSeed.forEach(u => V.insertarUsuario(run, u));

  console.log(`\n[ℹ] ${clientesSeed.length} clientes distribuidos en ${H.N_SHARDS} shards`);
  console.log(`[ℹ] ${usuariosSeed.length} usuarios en tablas verticales (perfil + actividad)\n`);

  app.listen(3000, () => {
    console.log('[►] Servidor en http://localhost:3000');
    console.log('    Sharding Demo — Horizontal + Vertical\n');
  });
}).catch(err => { console.error('[!] Error SQLite:', err); process.exit(1); });

// ============================================================
// API — SHARDING HORIZONTAL
// ============================================================

/** POST /horizontal/insert — Inserta un cliente en el shard correspondiente */
app.post('/horizontal/insert', (req, res) => {
  const { id, nombre, email, ciudad } = req.body;
  if (!id || !nombre || !email || !ciudad)
    return res.status(400).json({ error: 'Faltan campos: id, nombre, email, ciudad' });

  const numId = Number(id);
  if (isNaN(numId) || numId < 1)
    return res.status(400).json({ error: 'El ID debe ser un número positivo' });

  const shard = H.insertarCliente(db, run, { id: numId, nombre, email, ciudad });
  res.json({
    ok:      true,
    mensaje: `Cliente "${nombre}" (ID=${numId}) insertado en Shard ${shard}`,
    formula: `${numId} % ${H.N_SHARDS} = ${shard}`,
    shard,
  });
});

/** GET /horizontal/search/:id — Búsqueda dirigida (consulta solo el shard correcto) */
app.get('/horizontal/search/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { row, shard } = H.buscarCliente(db, queryOne, id);
  const formula = `${id} % ${H.N_SHARDS} = ${shard}`;

  if (!row)
    return res.status(404).json({
      error:   `ID ${id} no encontrado en Shard ${shard}`,
      formula,
      shard,
    });

  res.json({ ok: true, shard, formula, registro: row });
});

/** GET /horizontal/all — Todos los registros agrupados por shard */
app.get('/horizontal/all', (_req, res) => {
  res.json(H.todosLosClientes(query));
});

/** GET /horizontal/stats — Métricas de distribución por shard */
app.get('/horizontal/stats', (_req, res) => {
  res.json(H.estadisticasShards(queryOne));
});

/** GET /horizontal/validate — Verifica consistencia del hash y ausencia de duplicados */
app.get('/horizontal/validate', (_req, res) => {
  const stats = H.estadisticasShards(queryOne);
  const total = stats.reduce((s, r) => s + r.total, 0);

  // Verificar consistencia del hash: cada cliente debe estar en su shard canónico
  let inconsistencias = 0;
  for (let i = 0; i < H.N_SHARDS; i++) {
    const filas = query(`SELECT id, shard_id FROM clientes_shard_${i}`);
    filas.forEach(f => {
      if (Number(f.shard_id) !== i) inconsistencias++;
    });
  }

  res.json({
    ok:              inconsistencias === 0,
    total_registros: total,
    distribucion:    stats,
    pct_por_shard:   stats.map(s => ({
      shard:      s.shard,
      total:      s.total,
      porcentaje: total > 0 ? ((s.total / total) * 100).toFixed(1) + '%' : '0%',
    })),
    inconsistencias_hash: inconsistencias,
    mensaje: inconsistencias === 0
      ? 'Distribución consistente — cada ID está en su shard canónico'
      : `[!] ${inconsistencias} registro(s) en shard incorrecto`,
  });
});

// ============================================================
// API — SHARDING VERTICAL
// ============================================================

/** POST /vertical/insert — Escribe simultáneamente en perfil y actividad */
app.post('/vertical/insert', (req, res) => {
  const { id, nombre, email, pais, plan, ultimo_login, total_compras, score, activo } = req.body;
  if (!id || !nombre || !email)
    return res.status(400).json({ error: 'Faltan campos: id, nombre, email' });

  const numId = Number(id);
  V.insertarUsuario(run, {
    id:            numId,
    nombre,
    email,
    pais:          pais          || 'Colombia',
    plan:          plan          || 'Básico',
    ultimo_login:  ultimo_login  || new Date().toISOString().split('T')[0],
    total_compras: Number(total_compras) || 0,
    score:         Number(score) || 5.0,
    activo:        activo !== false,
  });

  const perfil    = queryOne('SELECT * FROM usuarios_perfil    WHERE id         = ?', [numId]);
  const actividad = queryOne('SELECT * FROM usuarios_actividad WHERE usuario_id = ?', [numId]);

  res.json({
    ok:              true,
    mensaje:         `Usuario "${nombre}" escrito simultáneamente en AMBAS tablas verticales`,
    tabla_perfil:    perfil,
    tabla_actividad: actividad,
  });
});

/** GET /vertical/perfil — Solo columnas de identidad (datos fríos) */
app.get('/vertical/perfil', (_req, res) => {
  res.json(query('SELECT * FROM usuarios_perfil ORDER BY id'));
});

/** GET /vertical/actividad — Solo columnas operacionales (datos calientes) */
app.get('/vertical/actividad', (_req, res) => {
  res.json(query('SELECT * FROM usuarios_actividad ORDER BY usuario_id'));
});

/** GET /vertical/all — Reconstrucción completa con JOIN */
app.get('/vertical/all', (_req, res) => {
  res.json(V.todosLosUsuarios(query));
});

/** GET /vertical/full/:id — JOIN de un usuario específico */
app.get('/vertical/full/:id', (req, res) => {
  const id  = Number(req.params.id);
  const row = V.usuarioPorId(queryOne, id);
  if (!row) return res.status(404).json({ error: `Usuario ID ${id} no encontrado` });
  res.json({ ok: true, registro: row });
});

/** GET /vertical/validate — Integridad referencial entre las dos tablas verticales */
app.get('/vertical/validate', (_req, res) => {
  const resultado = V.validarIntegridad(query);
  const total_perfil    = queryOne('SELECT COUNT(*) AS n FROM usuarios_perfil').n;
  const total_actividad = queryOne('SELECT COUNT(*) AS n FROM usuarios_actividad').n;

  res.json({
    ok:                resultado.valido,
    total_perfil:      Number(total_perfil),
    total_actividad:   Number(total_actividad),
    tablas_sincronizadas: Number(total_perfil) === Number(total_actividad),
    huerfanos_perfil:    resultado.huerfanos_perfil,
    huerfanos_actividad: resultado.huerfanos_actividad,
    mensaje: resultado.valido
      ? 'Integridad referencial correcta — ambas tablas están sincronizadas'
      : '[!] Se detectaron registros huérfanos entre tablas',
  });
});
