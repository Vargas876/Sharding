# Sharding Demo — Horizontal & Vertical 

Este proyecto es una aplicación web interactiva diseñada para demostrar y validar los conceptos de **Sharding Horizontal** y **Sharding Vertical** utilizando un entorno moderno basado en **Node.js** y **SQLite**.

## 📋 Descripción General

La aplicación simula la distribución de una base de datos a gran escala mediante dos técnicas principales:

1. **Sharding Horizontal (Partitioning by Rows):** Distribuye los registros de una tabla entre múltiples bases de datos (shards) utilizando una función hash basada en el ID (`id % N`). Esto permite escalar la carga de escritura y lectura.
2. **Sharding Vertical (Partitioning by Columns):** Divide una tabla con muchas columnas en tablas más pequeñas y especializadas (Datos de Perfil vs. Datos de Actividad), optimizando el rendimiento al consultar solo los datos necesarios.

## 🛠️ Tecnologías Utilizadas

* **Backend:** Node.js + Express.
* **Base de Datos:** SQLite (vía `sql.js` WASM), operando en memoria para una ejecución rápida y portable.
* **Frontend:** JavaScript Vanilla (SPA), HTML5 semántico y CSS3 moderno (Glassmorphism & Dark Mode).
* **Iconografía:** SVG Vectors (Lucide-style).

## 🚀 Instalación y Ejecución Local

### Requisitos Previos

* Node.js instalado (v16 o superior).

### Pasos

1. **Clonar o descargar** el proyecto.
2. Abrir una terminal en la carpeta raíz.
3. Instalar las dependencias:
   ```bash
   npm install
   ```
4. Iniciar el servidor:
   ```bash
   node server.js
   ```
5. Abrir en el navegador:
   `http://localhost:3000`

## 🔍 Guía de Validación para el Profesor

Para comprobar que el sistema funciona correctamente, se han implementado las siguientes herramientas en la pestaña **"Validación"**:

### Validación Horizontal

* **Distribución Uniforme:** El sistema inserta datos y calcula el porcentaje de ocupación de cada shard. Se debe observar un balance cercano al 33% en cada uno.
* **Consistencia del Hash:** Verifica que cada registro resida exclusivamente en el shard que le corresponde según la fórmula, garantizando que el routing sea determinista.

### Validación Vertical

* **Integridad Referencial:** Comprueba que cada fila en la tabla de `perfil` tenga su contraparte exacta en la tabla de `actividad`.
* **Reconstrucción total:** Demuestra que al aplicar un `JOIN` entre las tablas fragmentadas, no existe pérdida de información y el registro se recupera íntegro.---

**Proyecto académico para Electiva I**
Desarrollado con enfoque en escalabilidad de bases de datos y arquitectura distribuida.
