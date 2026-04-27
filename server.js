const express    = require('express');
const path       = require('path');
const cors       = require('cors');
const initSqlJs  = require('sql.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// INICIALIZAR sql.js (SQLite en WASM puro — sin compilación)
// ============================================================
let db; // instancia única en memoria

initSqlJs().then(SQL => {
  db = new SQL.Database();
  setupSchema();
  seedData();

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   Sharding Demo — Horizontal (3 shards) + Vertical (perfil/actividad)\n`);
  });
}).catch(err => {
  console.error('Error inicializando SQLite:', err);
  process.exit(1);
});

// ============================================================
// HELPER: ejecutar SQL y retornar filas como objetos
// ============================================================
function run(sql, params = []) {
  db.run(sql, params);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

// ============================================================
// SCHEMA
// ============================================================
const N_SHARDS = 3;

function setupSchema() {
  // HORIZONTAL: una tabla por shard
  for (let i = 0; i < N_SHARDS; i++) {
    run(`
      CREATE TABLE IF NOT EXISTS clientes_shard_${i} (
        id       INTEGER PRIMARY KEY,
        nombre   TEXT    NOT NULL,
        email    TEXT    NOT NULL,
        ciudad   TEXT    NOT NULL,
        shard_id INTEGER NOT NULL
      )
    `);
  }

  // VERTICAL: dos tablas especializadas
  run(`
    CREATE TABLE IF NOT EXISTS usuarios_perfil (
      id     INTEGER PRIMARY KEY,
      nombre TEXT    NOT NULL,
      email  TEXT    NOT NULL,
      pais   TEXT    NOT NULL,
      plan   TEXT    NOT NULL
    )
  `);
  run(`
    CREATE TABLE IF NOT EXISTS usuarios_actividad (
      usuario_id    INTEGER PRIMARY KEY,
      ultimo_login  TEXT    NOT NULL,
      total_compras INTEGER NOT NULL,
      score         REAL    NOT NULL,
      activo        INTEGER NOT NULL
    )
  `);
}

// ============================================================
// LÓGICA DE SHARDING HORIZONTAL
// ============================================================
function calcularShard(id) { return id % N_SHARDS; }

function insertarCliente({ id, nombre, email, ciudad }) {
  const shard = calcularShard(id);
  run(
    `INSERT OR REPLACE INTO clientes_shard_${shard} (id, nombre, email, ciudad, shard_id)
     VALUES (?, ?, ?, ?, ?)`,
    [id, nombre, email, ciudad, shard]
  );
  return shard;
}

function buscarCliente(id) {
  const shard = calcularShard(id);
  const row   = queryOne(`SELECT * FROM clientes_shard_${shard} WHERE id = ?`, [id]);
  return { row, shard };
}

function todosLosClientes() {
  return Array.from({ length: N_SHARDS }, (_, i) => ({
    shard: i,
    registros: query(`SELECT * FROM clientes_shard_${i} ORDER BY id`),
  }));
}

function estadisticasShards() {
  return Array.from({ length: N_SHARDS }, (_, i) => {
    const r = queryOne(`SELECT COUNT(*) AS total FROM clientes_shard_${i}`);
    return { shard: i, total: r ? r.total : 0 };
  });
}

// ============================================================
// LÓGICA DE SHARDING VERTICAL
// ============================================================
function insertarUsuario(u) {
  run(
    `INSERT OR REPLACE INTO usuarios_perfil (id, nombre, email, pais, plan)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, u.nombre, u.email, u.pais, u.plan]
  );
  run(
    `INSERT OR REPLACE INTO usuarios_actividad
     (usuario_id, ultimo_login, total_compras, score, activo)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, u.ultimo_login, u.total_compras, u.score, u.activo ? 1 : 0]
  );
}

function usuarioPorId(id) {
  return queryOne(`
    SELECT p.id, p.nombre, p.email, p.pais, p.plan,
           a.ultimo_login, a.total_compras, a.score, a.activo
    FROM   usuarios_perfil p
    JOIN   usuarios_actividad a ON p.id = a.usuario_id
    WHERE  p.id = ?`, [id]);
}

function todosLosUsuarios() {
  return query(`
    SELECT p.id, p.nombre, p.email, p.pais, p.plan,
           a.ultimo_login, a.total_compras, a.score, a.activo
    FROM   usuarios_perfil p
    JOIN   usuarios_actividad a ON p.id = a.usuario_id
    ORDER  BY p.id`);
}

// ============================================================
// SEED
// ============================================================
function seedData() {
  const clientes = [
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

  const usuarios = [
    { id: 1, nombre: 'Ana Rodríguez',  email: 'ana@mail.com',    pais: 'Colombia', plan: 'Premium', ultimo_login: '2026-04-25', total_compras: 45, score: 9.2, activo: true  },
    { id: 2, nombre: 'Carlos Méndez',  email: 'carlos@mail.com', pais: 'México',   plan: 'Básico',  ultimo_login: '2026-04-20', total_compras: 12, score: 6.5, activo: true  },
    { id: 3, nombre: 'Sofía Torres',   email: 'sofia@mail.com',  pais: 'Colombia', plan: 'Pro',     ultimo_login: '2026-04-26', total_compras: 78, score: 9.8, activo: true  },
    { id: 4, nombre: 'Diego Vargas',   email: 'diego@mail.com',  pais: 'España',   plan: 'Básico',  ultimo_login: '2026-03-10', total_compras:  3, score: 4.1, activo: false },
    { id: 5, nombre: 'Valentina Ruiz', email: 'val@mail.com',    pais: 'Colombia', plan: 'Premium', ultimo_login: '2026-04-27', total_compras: 99, score: 9.9, activo: true  },
    { id: 6, nombre: 'Mateo Gómez',    email: 'mateo@mail.com',  pais: 'Chile',    plan: 'Pro',     ultimo_login: '2026-04-15', total_compras: 34, score: 7.7, activo: true  },
  ];

  clientes.forEach(c => insertarCliente(c));
  usuarios.forEach(u => insertarUsuario(u));
  console.log(`   ✅ ${clientes.length} clientes y ${usuarios.length} usuarios cargados en memoria`);
}

// ============================================================
// ENDPOINTS — HORIZONTAL
// ============================================================
app.post('/horizontal/insert', (req, res) => {
  const { id, nombre, email, ciudad } = req.body;
  if (!id || !nombre || !email || !ciudad)
    return res.status(400).json({ error: 'Faltan campos: id, nombre, email, ciudad' });
  const numId = Number(id);
  if (isNaN(numId) || numId < 1)
    return res.status(400).json({ error: 'El ID debe ser un número positivo' });

  const shard = insertarCliente({ id: numId, nombre, email, ciudad });
  res.json({
    ok: true,
    mensaje: `Cliente "${nombre}" (ID=${numId}) insertado en Shard ${shard}`,
    formula: `${numId} % ${N_SHARDS} = ${shard}`,
    shard,
  });
});

app.get('/horizontal/search/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const { row, shard } = buscarCliente(id);
  if (!row)
    return res.status(404).json({
      error: `ID ${id} no encontrado en Shard ${shard}`,
      shard,
      formula: `${id} % ${N_SHARDS} = ${shard}`,
    });
  res.json({ ok: true, shard, formula: `${id} % ${N_SHARDS} = ${shard}`, registro: row });
});

app.get('/horizontal/all',   (_req, res) => res.json(todosLosClientes()));
app.get('/horizontal/stats', (_req, res) => res.json(estadisticasShards()));

// ============================================================
// ENDPOINTS — VERTICAL
// ============================================================
app.post('/vertical/insert', (req, res) => {
  const { id, nombre, email, pais, plan, ultimo_login, total_compras, score, activo } = req.body;
  if (!id || !nombre || !email)
    return res.status(400).json({ error: 'Faltan campos: id, nombre, email' });

  const numId = Number(id);
  insertarUsuario({
    id: numId,
    nombre,
    email,
    pais:          pais          || 'Colombia',
    plan:          plan          || 'Básico',
    ultimo_login:  ultimo_login  || new Date().toISOString().split('T')[0],
    total_compras: Number(total_compras) || 0,
    score:         Number(score) || 5.0,
    activo:        activo !== false,
  });

  const perfil   = queryOne('SELECT * FROM usuarios_perfil    WHERE id         = ?', [numId]);
  const actividad= queryOne('SELECT * FROM usuarios_actividad WHERE usuario_id = ?', [numId]);

  res.json({
    ok: true,
    mensaje:          `Usuario "${nombre}" escrito simultáneamente en AMBAS tablas verticales`,
    tabla_perfil:     perfil,
    tabla_actividad:  actividad,
  });
});

app.get('/vertical/perfil',     (_req, res) => res.json(query('SELECT * FROM usuarios_perfil    ORDER BY id')));
app.get('/vertical/actividad',  (_req, res) => res.json(query('SELECT * FROM usuarios_actividad ORDER BY usuario_id')));
app.get('/vertical/all',        (_req, res) => res.json(todosLosUsuarios()));

app.get('/vertical/full/:id', (req, res) => {
  const id  = Number(req.params.id);
  const row = usuarioPorId(id);
  if (!row) return res.status(404).json({ error: `Usuario ID ${id} no encontrado` });
  res.json({ ok: true, registro: row });
});
