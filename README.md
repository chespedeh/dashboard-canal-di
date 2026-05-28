# Dashboard Ventas - Guia Operativa

## Estructura de datos
Coloca los archivos en la carpeta `datos` (o `Datos`):

- `PRESUPUESTOS.xlsx`
- `VENTAS_2025.xlsx`
- `VENTAS_2026.xlsx`

Notas:

- `VENTAS_2025.xlsx` y `VENTAS_2026.xlsx` se tratan como ventas diarias.
- La venta real de 2026 se calcula con la columna `IMPORTE NETO`.
- La ultima columna sobrante de los Excel de ventas se ignora automaticamente.

## Actualizacion en un clic (Windows)
1. Ejecuta `update_dashboard.bat`.
2. Se lanzara `update_dashboard.ps1` con apertura del dashboard.

## Actualizacion por PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File .\update_dashboard.ps1 -OpenDashboard
```

Opciones utiles:

```powershell
# Fuerza regeneracion aunque no haya cambios en origen
powershell -ExecutionPolicy Bypass -File .\update_dashboard.ps1 -Force

# Ajusta reintentos (por defecto 3)
powershell -ExecutionPolicy Bypass -File .\update_dashboard.ps1 -MaxRetries 5
```

## Automatizacion diaria incluida
`update_dashboard.ps1` incorpora:

- deteccion de cambios en archivos fuente (`PRESUPUESTOS.xlsx`, `VENTAS_2025.xlsx`, `VENTAS_2026.xlsx`),
- reintentos automaticos de ejecucion,
- logs diarios en `datos/logs`.

Archivos de control generados:

- `datos/logs/update_YYYYMMDD.log`
- `datos/logs/source_state.json`

## Metricas nuevas de forecast
`generate_data.py` genera en `data.js`:

- `forecast.forecast_sales_month_end`
- `forecast.expected_compliance_pct_month_end`
- `forecast.required_daily_sales_to_budget`

Adicionalmente, cada agente incluye sus campos de forecast equivalentes para el desglose por agente.

## Publicacion y actualizacion automatica con GitHub

El workflow `.github/workflows/update-dashboard.yml` automatiza todo el ciclo:

### Configuracion inicial (una sola vez)

1. Crea un repositorio en GitHub (puede ser privado).
2. Sube todos los archivos del proyecto: `git push -u origin main`.
3. En GitHub > **Settings > Pages**, elige como fuente la rama `gh-pages` (se crea sola al primer push).
4. Copia la URL publica que te da GitHub Pages (p.ej. `https://tu-usuario.github.io/dashboard-ventas`).

### Flujo diario de actualizacion

1. Abre el Excel `VENTAS 2026.xlsx` y guarda los datos del dia.
2. En la carpeta del proyecto, ejecuta:

   ```bash
   git add "VENTAS 2026.xlsx"
   git commit -m "datos: actualizar ventas 27/05/2026"
   git push
   ```

3. GitHub Actions detecta el push, ejecuta `generate_data.py` y regenera `data.js` automaticamente.
4. El dashboard en GitHub Pages se actualiza en ~2 minutos.

> Tambien puedes lanzarlo manualmente en cualquier momento desde GitHub > pestaña **Actions** > **Actualizar Dashboard** > **Run workflow**.

### Que hace el workflow en detalle

| Paso | Descripcion |
|------|-------------|
| Checkout | Descarga el repo con los nuevos Excel |
| Python + dependencias | Instala openpyxl (segun requirements.txt) |
| Generar data.js | Ejecuta `generate_data.py` |
| Commit auto | Sube el `data.js` regenerado al repo |
| Deploy Pages | Publica `index.html`, `app.js`, `styles.css`, `data.js` en la URL publica |

### Notas de seguridad

- Los ficheros `.xlsx`, scripts `.py` y `.ps1` **no se publican** en la web (estan en `exclude_assets`).
- Si el repo es privado, el dashboard en GitHub Pages es **publico**. Para restringir el acceso necesitarias anadir autenticacion (Supabase Auth u otra solucion).

---

## Archivos clave
- `generate_data.py`: ETL principal y generacion de `data.js`.
- `app.js`: logica del dashboard, KPIs y tablas de forecast.
- `index.html`: estructura de la interfaz.
- `update_dashboard.ps1`: automatizacion de actualizacion local.
- `.github/workflows/update-dashboard.yml`: automatizacion en la nube con GitHub Actions.
