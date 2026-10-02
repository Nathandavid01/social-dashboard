# Recursos de clientes desde otra computadora

Biblioteca: [Nate Media — recursos por cliente en Google Drive](https://drive.google.com/drive/u/0/folders/1NvsQafeE5Te0HNN1c9UdK7O-f0T9iNLt). Corte: 2026-10-02. Estado: **subida en curso**.

16 paquetes con 649 archivos (1.81 GB): recursos disponibles de los 14 perfiles documentados, biblioteca común y recursos adicionales de marca. Los otros 80 clientes tienen fichas base; este respaldo no confirma recursos completos para ellos. El acceso requiere una cuenta autorizada a la carpeta de Drive. El enlace no otorga acceso por sí solo.

## Descargar y utilizar
1. Leer la [guía del cliente](GUIAS-POR-CLIENTE.md) actualizada desde Git.
2. Abrir Drive y descargar el ZIP del cliente. Añadir `recursos-compartidos-20261002.zip` cuando se necesite música/efectos. Descargar `SHA256SUMS` para comprobar integridad.
3. Comparar SHA256 con [el catálogo](styles/client-assets.json). En macOS: `shasum -a 256 archivo.zip`; en Windows PowerShell: `Get-FileHash archivo.zip -Algorithm SHA256`. Si se descargan todos los paquetes, `shasum -a 256 -c SHA256SUMS` comprueba el conjunto.
4. Descomprimir en una carpeta nueva. Cada ZIP incluye `MANIFEST.json` con ruta, tamaño y SHA256 de cada archivo. `workspace/` corresponde a Nate Media; `ssd/` al contenido del disco externo; `external/` a otros recursos referenciados.
5. Copiar los recursos requeridos al proyecto y adaptar sus rutas en la copia de trabajo. Las rutas `/Users/…` y `/Volumes/…` documentan procedencia; no existen automáticamente en otra computadora. Instalar la fuente exacta cuando esté disponible y su licencia permita el uso.

Se incluyen logos, fotos/referencias, fuentes disponibles, perfiles de captions, outros, música/efectos y datos de procedencia/licencia encontrados. Los paquetes contienen también versiones históricas y borradores: consultar la guía, fecha y aprobación antes de elegir. El respaldo no cambia licencias ni aprobaciones. No incluye toda la biblioteca de grabaciones crudas ni garantiza compatibilidad automática del motor antiguo con los perfiles nuevos.

**Monday’s:** usar el outro standalone v10 aprobado, SHA256 `770a776ede0699b0387996e46163f7c30b5c72825a0fb2e5eb82fcb061317268`. Los v5/v6/v9 del archivo son historial. La aprobación del outro no aprueba automáticamente el reel integrado.

**Ruta de fuente de Delian:** `Shoika-SemiBold.otf` está incluida en `workspace/video-pipeline/media/delian/brand/` dentro de su ZIP. Adaptar la referencia del perfil a esa ubicación al restaurar. Drop Coffee conserva documentación/referencias; su ZIP no equivale a un kit tipográfico confirmado. Otros faltantes específicos siguen en las guías.

## Paquetes

| Cliente / biblioteca | Archivo | Archivos internos | Tamaño |
|---|---|---:|---:|
| nanas | `nanas-20261002.zip` | 14 | 129.1 MB |
| arecibo | `arecibo-20261002.zip` | 7 | 34.1 MB |
| yabuuchi | `yabuuchi-20261002.zip` | 25 | 49.6 MB |
| truco | `truco-20261002.zip` | 8 | 68.2 MB |
| cheesys | `cheesys-20261002.zip` | 8 | 29.9 MB |
| delian | `delian-20261002.zip` | 60 | 59.7 MB |
| farmacia-buena-vida | `farmacia-buena-vida-20261002.zip` | 13 | 19.8 MB |
| mia-pizzeria | `mia-pizzeria-20261002.zip` | 9 | 7.2 MB |
| frida | `frida-20261002.zip` | 7 | 35.2 MB |
| drop-coffee | `drop-coffee-20261002.zip` | 4 | 0.1 MB |
| alacena | `alacena-20261002.zip` | 12 | 47.7 MB |
| black-pepper | `black-pepper-20261002.zip` | 10 | 48.1 MB |
| mondays-aguadilla | `mondays-aguadilla-20261002.zip` | 226 | 35.5 MB |
| apiario | `apiario-20261002.zip` | 6 | 6.2 MB |
| recursos-compartidos | `recursos-compartidos-20261002.zip` | 237 | 1229.1 MB |
| otros-recursos-marca | `otros-recursos-marca-20261002.zip` | 3 | 6.9 MB |

## Mantener el respaldo
Autorización de Eric, 2026-10-02: los recursos necesarios para videos y gráficos deben estar disponibles en R2 o Google Drive para trabajar desde otra computadora. Al incorporar o modificar un recurso reutilizable, guardar una versión nueva en la biblioteca autorizada, verificar la subida y registrar enlace, fecha, versión, tamaño y SHA256 en el catálogo y guía. Conservar los originales y versiones anteriores. Si falta el acceso o falla la subida, registrar el pendiente; no marcarlo respaldado.

Mantener las reglas/perfiles en Git y los archivos pesados en Drive o R2 con acceso apropiado. No publicar fuentes, música o recursos privados en un bucket público por conveniencia. La copia de este día es un respaldo puntual, no un servicio automático de sincronización; los editores/agentes deben ejecutar este paso en cada actualización pertinente.

Las guías del repositorio se comparten por commit/push y actualización de cada copia. La carpeta local original no se sincroniza bidireccionalmente con el repositorio. Entrega, revisión, aprobación y publicación permanecen separadas.
