# Documentación Técnica: Implementación de Sharding Horizontal y Vertical

## 1. Introducción

Este proyecto representa una solución educativa integral para el diseño, implementación y validación de técnicas de fragmentación de bases de datos (Sharding). Se ha desarrollado utilizando un stack moderno basado en **Node.js** y **SQLite (WASM)**, simulando un entorno de alta disponibilidad y escalabilidad.

---

## 2. Sharding Horizontal (Particionamiento de Filas)

### Concepto

El sharding horizontal consiste en dividir una tabla con un gran volumen de datos en múltiples tablas (shards) con el mismo esquema, pero con diferentes conjuntos de filas.

### Implementación Técnica

* **Algoritmo de Routing:** Se utilizó un esquema de **Hash-based Sharding**.
* **Fórmula:** `shard_id = ID % 3`.
* **Distribución:** Los datos se reparten en 3 shards lógicos (`clientes_shard_0`, `_1`, `_2`).
* **Ventajas demostradas:**
  * **Búsqueda Dirigida:** El sistema calcula el shard exacto antes de realizar la consulta, evitando escaneos innecesarios en otros shards (O(1) routing).
  * **Balanceo de Carga:** Se evita un "hot spot" centralizado al distribuir las inserciones.

---

## 3. Sharding Vertical (Particionamiento de Columnas)

### Concepto

El sharding vertical divide una tabla en tablas más pequeñas con diferentes columnas, agrupándolas según su frecuencia de acceso o naturaleza.

### Implementación Técnica

Se dividió la entidad `Usuario` en dos estructuras:

1. **Tabla `usuarios_perfil` (Datos Fríos):** Contiene información de identidad que cambia poco (nombre, email, país, plan).
2. **Tabla `usuarios_actividad` (Datos Calientes):** Contiene información transaccional y de alta frecuencia de actualización (último login, total de compras, score, estado activo).

### Ventajas demostradas

* **Optimización de I/O:** Al consultar solo el perfil, el motor no necesita cargar en memoria datos pesados de actividad.
* **Escalabilidad Selectiva:** Permite mover las tablas de alta actividad a discos más rápidos (SSD) mientras los perfiles permanecen en almacenamiento estándar.

---

## 4. Arquitectura de la Aplicación

### Stack Tecnológico

* **Servidor:** Express.js (Node.js) actuando como la "Capa de Enrutamiento" (Query Router).
* **Motor de Base de Datos:** `sql.js` (SQLite compilado a WebAssembly). Elegido por su capacidad de ejecutar SQL real en entornos de servidor y cliente sin dependencias nativas.
* **Frontend:** Arquitectura SPA (Single Page Application) que consume una API REST propia.

---

## 5. Plan de Validación e Integridad

Para garantizar que el sistema es robusto, se implementó una suite de validación automatizada:

1. **Consistencia de Distribución:** Validación de que la carga está equilibrada entre shards (idealmente ~33% por shard).
2. **Auditoría de Hash:** Un script recorre todos los shards verificando que no existan registros fuera de su ubicación canónica (evita pérdida de datos).
3. **Integridad Referencial Vertical:** Verificación de que cada ID en la tabla de perfil existe en la tabla de actividad, garantizando que el `JOIN` de reconstrucción sea exitoso.

---

## 6. Conclusiones

La implementación demuestra que el sharding no es solo una técnica de almacenamiento, sino una **decisión arquitectónica**. Mientras que el sharding horizontal permite manejar **volumen**, el vertical permite manejar **complejidad y frecuencia de acceso**. La combinación de ambas técnicas proporciona una base sólida para sistemas que pretenden escalar a millones de usuarios.

## 7. Enlaces de Acceso

* **Aplicación en vivo (Render):** [https://sharding.onrender.com/](https://sharding.onrender.com/)
* **Repositorio de Código (GitHub):** [https://github.com/Vargas876/Sharding](https://github.com/Vargas876/Sharding)

---

**Integrantes del Equipo:**

* Julian Velandia
* Camilo Niño
* Juan Vargas
