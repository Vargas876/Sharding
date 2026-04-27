/* ============================================================
   SHARDING DEMO — Frontend Logic
   ============================================================ */

const API = 'http://localhost:3000';

const SHARD_COLORS = ['#6366f1', '#06b6d4', '#10b981'];
const SHARD_NAMES  = ['Shard 0 (id % 3 = 0)', 'Shard 1 (id % 3 = 1)', 'Shard 2 (id % 3 = 2)'];

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('tab--active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('panel--active'));

  document.getElementById(`tab-${tab}`).classList.add('tab--active');
  document.getElementById(`tab-${tab}`).setAttribute('aria-selected', 'true');
  document.getElementById(`panel-${tab}`).classList.add('panel--active');
}

// ============================================================
// UTILITIES
// ============================================================
function showResult(elId, html, type = 'info') {
  const el = document.getElementById(elId);
  el.className = `result-box result-box--${type}`;
  el.innerHTML = html;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'Cargando...' : btn.dataset.label || btn.textContent;
}

function planTag(plan) {
  const cls = { 'Premium': 'plan-premium', 'Pro': 'plan-pro', 'Básico': 'plan-basico' };
  return `<span class="plan-tag ${cls[plan] || 'plan-basico'}">${plan}</span>`;
}

function activoBadge(activo) {
  return activo
    ? `<span class="status-ok"> Activo</span>`
    : `<span class="status-err"> Inactivo</span>`;
}

// ============================================================
// HORIZONTAL — INSERTAR CLIENTE
// ============================================================
async function insertarClienteH(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-insert-h');
  btn.disabled = true;
  btn.textContent = 'Insertando...';

  const body = {
    id:     document.getElementById('h-id').value,
    nombre: document.getElementById('h-nombre').value,
    email:  document.getElementById('h-email').value,
    ciudad: document.getElementById('h-ciudad').value,
  };

  try {
    const res  = await fetch(`${API}/horizontal/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    const color = SHARD_COLORS[data.shard];
    showResult('result-insert-h', `
[✓] ${data.mensaje}

• Fórmula: ${data.formula}
• Asignado a: <span style="color:${color};font-weight:700">Shard ${data.shard}</span>
    `, 'success');

    document.getElementById('form-h-insert').reset();
    await cargarTodosH();

  } catch (err) {
    showResult('result-insert-h', `[!] Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Insertar';
  }
}

// ============================================================
// HORIZONTAL — BUSCAR CLIENTE
// ============================================================
async function buscarClienteH(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-search-h');
  btn.disabled = true;
  btn.textContent = 'Buscando...';

  const id = document.getElementById('h-search-id').value;

  try {
    const res  = await fetch(`${API}/horizontal/search/${id}`);
    const data = await res.json();

    if (!res.ok) {
      showResult('result-search-h', `
[✗] No encontrado

• Fórmula: ${data.formula}
• Se buscó en: Shard ${data.shard} (único shard posible)
ℹ Solo 1 de 3 shards fue consultado
      `, 'error');
      return;
    }

    const color = SHARD_COLORS[data.shard];
    const r = data.registro;
    showResult('result-search-h', `
[✓] Cliente encontrado

• Fórmula: ${data.formula}
• Encontrado en: <span style="color:${color};font-weight:700">Shard ${data.shard}</span>
ℹ Solo 1 de 3 shards fue consultado

   ID:     ${r.id}
   Nombre: ${r.nombre}
   Email:  ${r.email}
   Ciudad: ${r.ciudad}
    `, 'success');

  } catch (err) {
    showResult('result-search-h', `[!] Error de conexión: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buscar';
  }
}

// ============================================================
// HORIZONTAL — CARGAR TODOS LOS SHARDS
// ============================================================
async function cargarTodosH() {
  try {
    const [allRes, statsRes] = await Promise.all([
      fetch(`${API}/horizontal/all`),
      fetch(`${API}/horizontal/stats`),
    ]);

    const shards = await allRes.json();
    const stats  = await statsRes.json();

    // Stats bar
    const totalRegistros = stats.reduce((acc, s) => acc + s.total, 0);
    const statsBar = document.getElementById('stats-bar');
    statsBar.innerHTML = stats.map(s => {
      const pct = totalRegistros > 0 ? Math.round((s.total / totalRegistros) * 100) : 0;
      return `
        <div class="stat-pill">
          <span class="stat-dot" style="background:${SHARD_COLORS[s.shard]}"></span>
          <span class="stat-count">${s.total}</span>
          <span class="stat-label">Shard ${s.shard} · ${pct}%</span>
        </div>`;
    }).join('') + `
      <div class="stat-pill">
        <span class="stat-dot" style="background:#fff;opacity:.3"></span>
        <span class="stat-count">${totalRegistros}</span>
        <span class="stat-label">total</span>
      </div>`;

    // Shards grid
    const grid = document.getElementById('shards-grid');
    grid.innerHTML = shards.map(s => {
      const rows = s.registros;
      const rowsHtml = rows.length === 0
        ? `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-dim)">Sin registros</td></tr>`
        : rows.map(r => `
            <tr>
              <td><span class="id-badge" style="color:${SHARD_COLORS[s.shard]}">#${r.id}</span></td>
              <td>${r.nombre}</td>
              <td style="color:var(--text-muted)">${r.ciudad}</td>
              <td style="color:var(--text-muted);font-size:0.72rem">${r.email}</td>
            </tr>`).join('');

      return `
        <div class="shard-panel shard-panel--${s.shard}">
          <div class="shard-header">
            <span>Shard ${s.shard}</span>
            <span class="shard-badge">${rows.length} fila${rows.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="shard-body">
            <table class="shard-table">
              <thead>
                <tr>
                  <th>ID</th><th>Nombre</th><th>Ciudad</th><th>Email</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    document.getElementById('shards-grid').innerHTML =
      `<div class="shard-loading" style="color:#fca5a5"> Error cargando datos: ${err.message}</div>`;
  }
}

// ============================================================
// VERTICAL — INSERTAR USUARIO
// ============================================================
async function insertarUsuarioV(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-insert-v');
  btn.disabled = true;
  btn.textContent = 'Insertando en ambas tablas...';

  const body = {
    id:            document.getElementById('v-id').value,
    nombre:        document.getElementById('v-nombre').value,
    email:         document.getElementById('v-email').value,
    pais:          document.getElementById('v-pais').value || 'Colombia',
    plan:          document.getElementById('v-plan').value,
    total_compras: document.getElementById('v-compras').value || 0,
    score:         document.getElementById('v-score').value || 5.0,
    activo:        true,
  };

  try {
    const res  = await fetch(`${API}/vertical/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    const p = data.tabla_perfil;
    const a = data.tabla_actividad;
    showResult('result-insert-v', `
[✓] ${data.mensaje}

• usuarios_perfil:
   id: ${p.id} | nombre: ${p.nombre} | plan: ${p.plan}

• usuarios_actividad:
   usuario_id: ${a.usuario_id} | compras: ${a.total_compras} | score: ${a.score}

ℹ JOIN los reconstruye como una sola fila
    `, 'success');

    document.getElementById('form-v-insert').reset();
    await cargarTodosV();

  } catch (err) {
    showResult('result-insert-v', `[!] Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Insertar en ambas tablas';
  }
}

// ============================================================
// VERTICAL — BUSCAR CON JOIN
// ============================================================
async function buscarUsuarioV(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-search-v');
  btn.disabled = true;
  btn.textContent = 'Ejecutando JOIN...';

  const id = document.getElementById('v-search-id').value;

  try {
    const res  = await fetch(`${API}/vertical/full/${id}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    const r = data.registro;
    showResult('result-search-v', `
[✓] Registro reconstruido con JOIN

• De usuarios_perfil:
   nombre: ${r.nombre}
   email:  ${r.email}
   país:   ${r.pais}
   plan:   ${r.plan}

• De usuarios_actividad:
   último login:   ${r.ultimo_login}
   total compras:  ${r.total_compras}
   score:          ${r.score}
   activo:         ${r.activo ? 'Sí' : 'No'}

ℹ SQL: SELECT * FROM usuarios_perfil p
        JOIN usuarios_actividad a ON p.id = a.usuario_id
        WHERE p.id = ${id}
    `, 'success');

  } catch (err) {
    showResult('result-search-v', `[!] Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hacer JOIN';
  }
}

// ============================================================
// VERTICAL — CARGAR TABLAS
// ============================================================
async function cargarTodosV() {
  try {
    const [perfilRes, activRes] = await Promise.all([
      fetch(`${API}/vertical/perfil`),
      fetch(`${API}/vertical/actividad`),
    ]);

    const perfiles = await perfilRes.json();
    const activos  = await activRes.json();

    const grid = document.getElementById('v-tables-grid');

    const perfilRows = perfiles.map(p => `
      <tr>
        <td><span class="id-badge" style="color:var(--perfil)">#${p.id}</span></td>
        <td>${p.nombre}</td>
        <td style="color:var(--text-muted);font-size:0.75rem">${p.email}</td>
        <td>${p.pais}</td>
        <td>${planTag(p.plan)}</td>
      </tr>`).join('');

    const activRows = activos.map(a => `
      <tr>
        <td><span class="id-badge" style="color:var(--activ)">#${a.usuario_id}</span></td>
        <td>${a.ultimo_login}</td>
        <td style="text-align:center">${a.total_compras}</td>
        <td>
          <span style="font-weight:600;color:${a.score >= 8 ? '#6ee7b7' : a.score >= 5 ? '#fcd34d' : '#fca5a5'}">
            ${Number(a.score).toFixed(1)}
          </span>
        </td>
        <td>${activoBadge(a.activo)}</td>
      </tr>`).join('');

    grid.innerHTML = `
      <div class="v-panel v-panel--perfil">
        <div class="v-panel-header">
          <span><svg style="width:14px;height:14px;margin-right:4px;vertical-align:middle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> usuarios_perfil</span>
          <span class="shard-badge">${perfiles.length} filas · identidad</span>
        </div>
        <div class="v-panel-body">
          <table class="v-panel-table">
            <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>País</th><th>Plan</th></tr></thead>
            <tbody>${perfilRows || '<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-dim)">Sin datos</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="v-panel v-panel--activ">
        <div class="v-panel-header">
          <span><svg style="width:14px;height:14px;margin-right:4px;vertical-align:middle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> usuarios_actividad</span>
          <span class="shard-badge">${activos.length} filas · operacional</span>
        </div>
        <div class="v-panel-body">
          <table class="v-panel-table">
            <thead><tr><th>ID</th><th>Último login</th><th>Compras</th><th>Score</th><th>Estado</th></tr></thead>
            <tbody>${activRows || '<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-dim)">Sin datos</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

  } catch (err) {
    document.getElementById('v-tables-grid').innerHTML =
      `<div class="shard-loading" style="color:#fca5a5">[!] Error cargando tablas: ${err.message}</div>`;
  }
}

// ============================================================
// VALIDACIÓN — HORIZONTAL
// Ejecuta GET /horizontal/validate y renderiza resultados
// ============================================================
async function validarHorizontal() {
  const btn = document.getElementById('btn-val-h');
  btn.disabled = true;
  btn.textContent = 'Validando...';

  try {
    const res  = await fetch(`${API}/horizontal/validate`);
    const data = await res.json();

    const dist = data.pct_por_shard.map(s =>
      `  Shard ${s.shard}: ${String(s.total).padStart(2)} registros · ${s.porcentaje}`
    ).join('\n');

    const iconoGlobal = data.ok ? '[✓]' : '[✗]';
    const iconoHash   = data.inconsistencias_hash === 0 ? '✓' : '✗';
    const iconoDist   = data.ok ? '✓' : '✗';

    showResult('result-val-h', `
${iconoGlobal} ${data.mensaje}

• Distribución de ${data.total_registros} registros:
${dist}

[${iconoDist}] Distribución uniforme: ~33% por shard
[${iconoHash}] Consistencia del hash: ${data.inconsistencias_hash === 0
  ? 'Sin inconsistencias — cada ID está en su shard canónico'
  : `${data.inconsistencias_hash} registro(s) en shard incorrecto`}
ℹ Sin duplicados entre shards (hash determinista)
    `, data.ok ? 'success' : 'error');

  } catch (err) {
    showResult('result-val-h', `[!] Error de conexión: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ejecutar validación horizontal';
  }
}

// ============================================================
// VALIDACIÓN — VERTICAL
// Ejecuta GET /vertical/validate y renderiza resultados
// ============================================================
async function validarVertical() {
  const btn = document.getElementById('btn-val-v');
  btn.disabled = true;
  btn.textContent = 'Validando...';

  try {
    const res  = await fetch(`${API}/vertical/validate`);
    const data = await res.json();

    const iconoGlobal = data.ok ? '[✓]' : '[✗]';
    const iconoSync   = data.tablas_sincronizadas ? '✓' : '✗';
    const iconoHuerf  = (data.huerfanos_perfil.length === 0 && data.huerfanos_actividad.length === 0) ? '✓' : '✗';

    // Calcular columnas totales reconstruidas por JOIN
    const colsPerfil   = 5; // id, nombre, email, pais, plan
    const colsActividad= 5; // usuario_id, ultimo_login, total_compras, score, activo
    const colsJoin     = colsPerfil + colsActividad - 1; // -1 porque id es compartido

    showResult('result-val-v', `
${iconoGlobal} ${data.mensaje}

• usuarios_perfil:    ${data.total_perfil} fila(s) · ${colsPerfil} columnas (datos fríos)
• usuarios_actividad: ${data.total_actividad} fila(s) · ${colsActividad} columnas (datos calientes)

[${iconoSync}] Tablas sincronizadas: ${data.tablas_sincronizadas ? 'Sí' : 'No — conteos distintos'}
[${iconoHuerf}] Sin huérfanos en perfil:    ${data.huerfanos_perfil.length === 0 ? 'Correcto' : `${data.huerfanos_perfil.length} huérfano(s)`}
[${iconoHuerf}] Sin huérfanos en actividad: ${data.huerfanos_actividad.length === 0 ? 'Correcto' : `${data.huerfanos_actividad.length} huérfano(s)`}

ℹ JOIN reconstruye: ${colsJoin} columnas por fila (integridad total)
ℹ SQL utilizado:
   SELECT p.*, a.ultimo_login, a.total_compras, a.score, a.activo
   FROM usuarios_perfil p
   JOIN usuarios_actividad a ON p.id = a.usuario_id
    `, data.ok ? 'success' : 'error');

  } catch (err) {
    showResult('result-val-v', `[!] Error de conexión: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ejecutar validación vertical';
  }
}

// ============================================================
// INIT — cargar datos al arrancar
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  cargarTodosH();
  cargarTodosV();
});
