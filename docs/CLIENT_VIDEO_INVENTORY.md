# Videos sin publicar por cliente

Sección de Inicio para owner y supervisor (`inventory.read`). Usa la sesión del usuario y RLS, sin elevar acceso al leer el dashboard. Consulta clientes, perfiles, asignaciones e ideas en páginas de500filas. Cada idea cuenta una pieza: varias tomas/versiones no aumentan el contador.

- **Editor asignado**: principal de `clients.assigned_to` y adicionales de `client_editor_assignments`; `edit_mode=ai` añade IA. No atribuye autoría histórica al editor actual.
- **Editados**: ideas con al menos un archivo de video editado utilizable y sin señal de publicación. Incluye los programados con editado.
- **Crudos sin editar**: ideas con video crudo utilizable y sin editado; no incluye piezas programadas.
- **Programados**: posts de video de Metricool con proveedorPENDING, sin publicación en ninguna red, fuera de borradores y con autopublicación habilitada. También cuenta videos programados directamente en Metricool; se deduplican por post, no por red. Una fecha prevista no basta.
- Se excluyen ideas descartadas, `publicada`, `published_at` y marca manual `posted`. Las imágenes, B-roll aislados y archivos fallidos/archivados/en subida no cuentan.
- Un post vinculado ya publicado en Metricool excluye la idea aunque el dashboard esté atrasado. Un vínculo ausente, eliminado o imposible de verificar queda fuera y se muestra como pieza por verificar. Fallos de calendario se muestran como «Sin verificar», nunca cero.

Ventana Metricool: enero del año anterior a diciembre del siguiente, en Puerto Rico. Caché por perfil de5minutos, con permiso antes de leerla. Se consulta en grupos de6clientes con timeout del cliente Metricool; la sección se transmite en Suspense y no bloquea Inicio. Las publicaciones manuales no vinculadas no pueden conciliarse por título: requieren auditoría de contenido y actualización de su vínculo/estado.

Validación2026-10-13:80pruebas de lógica/UI/permiso y estados de publicación; TypeScript sin errores; relationship guard correcto. Lint del código nuevo correcto. Inicio conserva15hallazgos de variables/imports sin uso idénticos a `github/main`, fuera de este cambio. Consulta de lectura real:96clientes,1113ideas,72asignaciones adicionales,0errores de calendario. Los datos reales se guardaron fuera del código distribuible; la vista previa pública usa ejemplos.

Vista previa: `public/previews/v5.132-inventario-videos.html`. No se han publicado ni modificado videos, asignaciones ni estados de producción al construir esta sección.
