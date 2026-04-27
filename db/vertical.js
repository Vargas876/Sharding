/**
 * db/vertical.js
 * ─────────────────────────────────────────────────────────────
 * Módulo de Sharding Vertical
 *
 * Estrategia: Column-split partitioning
 *   La entidad "usuarios" se divide en dos tablas especializadas
 *   según la frecuencia de acceso y naturaleza de sus columnas:
 *
 *   usuarios_perfil    → datos de identidad (baja frecuencia de cambio)
 *   usuarios_actividad → datos operacionales (alta frecuencia de escritura)
 *
 * Ventaja: reduce contención en escrituras y mejora rendimiento
 * al separar columnas "frías" de columnas "calientes".
 *
 * La fila completa se reconstruye mediante JOIN bajo demanda.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Inicializa las dos tablas verticales en la instancia de DB.
 * @param {Object} db  - Instancia sql.js Database
 * @param {Function} run - Helper para ejecutar DDL/DML
 */
function initVertical(db, run) {
  // Tabla 1: datos de perfil — baja frecuencia de cambio
  run(`
    CREATE TABLE IF NOT EXISTS usuarios_perfil (
      id     INTEGER PRIMARY KEY,
      nombre TEXT    NOT NULL,
      email  TEXT    NOT NULL,
      pais   TEXT    NOT NULL,
      plan   TEXT    NOT NULL
    )
  `);

  // Tabla 2: datos de actividad — alta frecuencia de escritura
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

/**
 * Inserta un usuario de forma simultánea en AMBAS tablas verticales.
 * Garantiza integridad escribiendo perfil y actividad en la misma
 * operación atómica (simulación de transacción).
 *
 * @param {Function} run  - Helper de ejecución SQL
 * @param {Object}   u    - Datos del usuario
 */
function insertarUsuario(run, u) {
  // Escritura en tabla de perfil (datos fríos)
  run(
    `INSERT OR REPLACE INTO usuarios_perfil (id, nombre, email, pais, plan)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, u.nombre, u.email, u.pais, u.plan]
  );

  // Escritura en tabla de actividad (datos calientes)
  run(
    `INSERT OR REPLACE INTO usuarios_actividad
     (usuario_id, ultimo_login, total_compras, score, activo)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, u.ultimo_login, u.total_compras, u.score, u.activo ? 1 : 0]
  );
}

/**
 * Reconstruye la fila completa de un usuario mediante JOIN.
 * Demuestra que el sharding vertical no pierde información:
 * la entidad se recupera íntegra al unir ambas tablas.
 *
 * @param {Function} queryOne
 * @param {number}   id
 * @returns {Object|null}
 */
function usuarioPorId(queryOne, id) {
  return queryOne(`
    SELECT p.id, p.nombre, p.email, p.pais, p.plan,
           a.ultimo_login, a.total_compras, a.score, a.activo
    FROM   usuarios_perfil p
    JOIN   usuarios_actividad a ON p.id = a.usuario_id
    WHERE  p.id = ?`, [id]);
}

/**
 * Retorna todos los usuarios reconstruidos con JOIN.
 * @param {Function} query
 * @returns {Array}
 */
function todosLosUsuarios(query) {
  return query(`
    SELECT p.id, p.nombre, p.email, p.pais, p.plan,
           a.ultimo_login, a.total_compras, a.score, a.activo
    FROM   usuarios_perfil p
    JOIN   usuarios_actividad a ON p.id = a.usuario_id
    ORDER  BY p.id`);
}

/**
 * Valida integridad referencial entre las dos tablas verticales.
 * Verifica que todo usuario en perfil tenga su registro en actividad
 * y viceversa.
 * @param {Function} query
 * @returns {{ valido: boolean, huerfanos_perfil: Array, huerfanos_actividad: Array }}
 */
function validarIntegridad(query) {
  const huerfanos_perfil = query(`
    SELECT p.id FROM usuarios_perfil p
    LEFT JOIN usuarios_actividad a ON p.id = a.usuario_id
    WHERE a.usuario_id IS NULL`);

  const huerfanos_actividad = query(`
    SELECT a.usuario_id FROM usuarios_actividad a
    LEFT JOIN usuarios_perfil p ON a.usuario_id = p.id
    WHERE p.id IS NULL`);

  return {
    valido: huerfanos_perfil.length === 0 && huerfanos_actividad.length === 0,
    huerfanos_perfil,
    huerfanos_actividad,
  };
}

module.exports = {
  initVertical,
  insertarUsuario,
  usuarioPorId,
  todosLosUsuarios,
  validarIntegridad,
};
