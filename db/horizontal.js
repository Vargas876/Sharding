/**
 * db/horizontal.js
 * ─────────────────────────────────────────────────────────────
 * Módulo de Sharding Horizontal
 *
 * Estrategia: Hash-based partitioning
 *   shard_id = cliente_id % N_SHARDS
 *
 * Cada shard es una tabla independiente dentro del mismo motor
 * SQLite, replicando la separación lógica de un sistema
 * distribuido real.
 * ─────────────────────────────────────────────────────────────
 */

const N_SHARDS = 3;

/**
 * Inicializa las tablas de shards en la instancia de DB.
 * @param {Object} db - Instancia sql.js Database
 * @param {Function} run - Helper para ejecutar DDL/DML sin retorno
 */
function initHorizontal(db, run) {
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
}

/**
 * Capa de enrutamiento: calcula el shard destino para un ID.
 * Garantiza que el mismo ID siempre caiga en el mismo shard
 * (consistencia determinista del hash).
 * @param {number} id
 * @returns {number} índice de shard (0..N_SHARDS-1)
 */
function calcularShard(id) {
  return id % N_SHARDS;
}

/**
 * Inserta un cliente en el shard que corresponde a su ID.
 * La capa de enrutamiento determina la tabla destino.
 * @param {Object} db
 * @param {Function} run
 * @param {{ id, nombre, email, ciudad }} cliente
 * @returns {number} shard asignado
 */
function insertarCliente(db, run, { id, nombre, email, ciudad }) {
  const shard = calcularShard(id);
  run(
    `INSERT OR REPLACE INTO clientes_shard_${shard}
     (id, nombre, email, ciudad, shard_id) VALUES (?, ?, ?, ?, ?)`,
    [id, nombre, email, ciudad, shard]
  );
  return shard;
}

/**
 * Busca un cliente por ID consultando ÚNICAMENTE el shard correcto
 * (búsqueda dirigida — sin escaneo global entre shards).
 * @param {Object} db
 * @param {Function} queryOne
 * @param {number} id
 * @returns {{ row: Object|null, shard: number }}
 */
function buscarCliente(db, queryOne, id) {
  const shard = calcularShard(id);
  const row   = queryOne(
    `SELECT * FROM clientes_shard_${shard} WHERE id = ?`, [id]
  );
  return { row, shard };
}

/**
 * Retorna todos los registros agrupados por shard.
 * Útil para visualizar distribución de datos en tiempo real.
 */
function todosLosClientes(query) {
  return Array.from({ length: N_SHARDS }, (_, i) => ({
    shard: i,
    registros: query(`SELECT * FROM clientes_shard_${i} ORDER BY id`),
  }));
}

/**
 * Retorna el conteo de registros por shard.
 * Permite verificar distribución uniforme (~33% por shard).
 */
function estadisticasShards(queryOne) {
  return Array.from({ length: N_SHARDS }, (_, i) => {
    const r = queryOne(`SELECT COUNT(*) AS total FROM clientes_shard_${i}`);
    return { shard: i, total: r ? Number(r.total) : 0 };
  });
}

/**
 * Valida que no existan duplicados de un ID entre shards.
 * Un ID solo puede existir en su shard canónico.
 * @returns {{ valido: boolean, duplicados: Array }}
 */
function validarConsistencia(queryOne) {
  const duplicados = [];
  for (let id = 1; id <= 9999; id++) {
    const shardCanonico = calcularShard(id);
    for (let s = 0; s < N_SHARDS; s++) {
      if (s === shardCanonico) continue;
      const row = queryOne(`SELECT id FROM clientes_shard_${s} WHERE id = ?`, [id]);
      if (row) duplicados.push({ id, shardCanonico, shardEncontradoEn: s });
    }
  }
  return { valido: duplicados.length === 0, duplicados };
}

module.exports = {
  N_SHARDS,
  initHorizontal,
  calcularShard,
  insertarCliente,
  buscarCliente,
  todosLosClientes,
  estadisticasShards,
  validarConsistencia,
};
