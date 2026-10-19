This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3020](http://localhost:3020) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

### Calendario de publicaciones (v5.131)

En **Recibos** (`/recibo`), **Calendario** es la pestaña inicial para usuarios con permiso `metricool.read` y muestra los posts existentes en Metricool en vistas de mes y semana, con miniaturas, horarios de Puerto Rico y filtros por cliente y estado. El panel derecho reúne próximas publicaciones, conteos por estado y posts que necesitan atención. La pestaña **Contenido recibido** conserva el tablero de videos y aprobaciones; cambiar de pestaña conserva las subidas pendientes del calendario. Sin permiso de lectura de Metricool, Recibos muestra directamente el contenido recibido.

### Videos por día en Recibo (v5.148)

En **Contenido recibido**, Hoy / Mañana / una fecha concreta muestran en una sola lista los videos de todos los clientes que salen ese día, ordenados por hora de Puerto Rico. Cada tarjeta indica si la fecha es programada en Metricool, prevista o sugerida por cadencia; no se inventa un día para piezas sin fecha. Los filtros de cliente, estado y búsqueda se combinan con el día. Reproducir el video sigue siendo abrir la tarjeta. No cambia permisos de publicación.

El panel **Frecuencia por cliente** muestra los días por semana y el horario/tipo guardados. Las marcas punteadas **Previsto** indican los días que le toca publicar según `posting_days`, independientemente de los posts reales y del filtro de estados. Se muestran en mes y semana; el selector de cliente filtra también estas marcas. Si hay más de dos clientes previstos en un día, pulsa **+N clientes previstos** para verlos todos. Los clientes sin días válidos guardados muestran **Sin frecuencia configurada**. `posting_schedule` puede contener un horario por día o tipos heredados («reel», «post», «story»); una hora válida por día prevalece sobre `posting_time`, y los tipos conservan la hora general válida. Sin ninguna hora válida, el panel muestra **Sin hora**. Mostrar estas marcas no inventa días ni horarios ni modifica los ajustes.

Con permiso **cadence.edit**, pulsa **Configurar frecuencia** junto al cliente en el panel derecho. El diálogo permite seleccionar días, hora general y horas por día. Guarda automáticamente, bloquea los controles y el cierre mientras espera la respuesta y actualiza la frecuencia y las marcas solo después de confirmar. Si falla, revierte el campo y muestra un error. Los horarios válidos por día tienen prioridad sobre el general; vaciar una hora por día permite usar la general. Quitar un día elimina su ajuste particular. Cambiar la frecuencia no reprograma posts de Metricool.

Cada cliente tiene el mismo calendario en `/clients/[id]/calendar` y en su pestaña **Calendario**. Desde el perfil puedes abrirlo con **Calendario de publicaciones**. Esta vista consulta la identidad del cliente en el servidor, incluidas las cuentas compartidas.

Con permiso `posting.calendar.upload` (owner/supervisor), **Subir contenido** adjunta un JPG/PNG (hasta 20 MB) o MP4/MOV (hasta 2 GB), título, caption, redes del cliente y fecha/hora de Puerto Rico. Los archivos van directamente a Entregas R2; los videos grandes usan multipart. La subida crea un borrador en Metricool con `autoPublish: false`, sin modificar aprobaciones. Abre su tarjeta para programarlo. Dentro del mismo diálogo, un reintento conserva la identidad y reutiliza el archivo si ya terminó de subir; esa recuperación no sobrevive a una recarga de la página. Si cambias el filtro de cliente con una subida preparada, vuelve al calendario original para continuar. Los envíos inciertos requieren verificación y nunca se reenvían automáticamente.

Abre una tarjeta para ver el caption, el estado por red y los enlaces disponibles. **Publicado** requiere que todas las redes estén en `PUBLISHED`; una publicación parcial, un error o un estado sin confirmar permanece identificado. **Verificar** consulta Metricool de nuevo; la actualización automática se ejecuta cada minuto mientras la página está visible en el navegador, incluso en la pestaña **Contenido recibido**. Si una cuenta falla, el calendario advierte que la verificación y los conteos están incompletos.

Con permiso `metricool.write`, abre un post pendiente y elige **Guardar como borrador** para desactivar su publicación automática. Con ese permiso y `posting.publish`, elige una fecha y hora futuras en Puerto Rico (UTC−4) y pulsa **Programar** para activar la publicación automática del mismo post. Los posts publicados en una o más redes conservan su historial y no se pueden reprogramar desde estos controles.

Los cambios de borrador/programación vuelven a leer el post y después consultan Metricool para comprobar el resultado; la subida también consulta el borrador creado. Si aparece un cambio o borrador pendiente de verificar, o falla la conexión tras enviar, usa **Verificar calendario** antes de repetir la acción. La validación de esta entrega incluye escrituras simuladas y consultas reales de lectura; no se probaron subidas, creación de borradores ni cambios de programación reales. Ver [notas de implementación](CLAUDE.md#calendario-de-publicaciones).

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Posts pendientes en el calendario (v5.140)

Por instrucción de Eric del 18 de octubre de 2026, la cobertura de Recibo incluye gráficas y videos. Reemplaza la restricción anterior a videos: las gráficas se proyectan en días Post, los videos en Reel y los días sin formato admiten ambos en orden de recepción. Story queda excluido. Las piezas ya programadas/publicadas y los días ocupados no se vuelven a asignar.

Sin una frecuencia compatible se muestran las piezas en **Sin fecha**, con su imagen o reproductor y aprobación real. Configurar frecuencia permite proyectarlas; la proyección no programa ni publica contenido. Comprobar con `lib/recibo/calendar-projection.test.ts` y `components/published/content-calendar.projection.test.tsx`.

### Frecuencias basadas en historial por cliente

- [643 Sport Bar & Pizzería: frecuencia y evidencia histórica](docs/client-rules/643-publication-frequency.md). Regla específica de esta cuenta, por instrucción de Eric del 18 de octubre de 2026.


### Borradores al colocar Recibo en el calendario (v5.141)

Eric, 18 de octubre de 2026: arrastrar una pieza aprobada a un día expresa la decisión de crear su **borrador en Metricool para ese día**, con la hora de la frecuencia del cliente y zona de Puerto Rico. Las proyecciones automáticas siguen siendo sugerencias. El botón **Elegir fecha de borrador** ofrece la misma acción en teléfono y teclado. La aprobación de Recibo y el permiso de publicación siguen siendo necesarios; esta acción no publica automáticamente.

Solo se acepta el cliente seleccionado y el archivo editado actual de una pieza pendiente. Durante el envío se bloquean operaciones duplicadas y cambios de calendario; al confirmar se retira su sugerencia y se actualizan Recibo y Metricool. Ante error o resultado desconocido se conserva la pieza y se solicita verificar Metricool antes de reenviar. Los ensayos de escritura usan mocks; no se creó contenido real para validar esta función.

Vista previa: `/previews/v5.141-calendar-drafts.html`.

Límite de concurrencia: el envío vuelve a comprobar cliente y archivo elegido; la reserva en la idea compara cliente, estado y aprobación. Los archivos adjuntos viven en otra tabla, por lo que una sustitución concurrente posterior a esa comprobación no queda bloqueada atómicamente por esta reserva.

### Evitar publicaciones repetidas en Recibo (v5.142)

Eric, 18 de octubre de 2026: lo ya publicado debe salir de la lista pendiente para evitar repetir publicaciones. Los indicadores existentes de publicación/programación continúan excluyendo la pieza de Recibo y de sus proyecciones. El cruce con posts manuales de Metricool también reconoce **imágenes individuales idénticas byte por byte (SHA-256)**, usando solo la cuenta guardada del cliente y el archivo editado actual en R2/Entregas R2. Los títulos y tamaños de gráficas no identifican una publicación. El tamaño se conserva como criterio histórico para videos, excluyendo ahora archivos reconocidos como imágenes.

Un post publicado en al menos una red o programado sin ser borrador puede retirar una pieza pendiente; un borrador no la retira por este cruce. Los carruseles, imágenes transformadas, fuentes sin cuenta guardada, archivos mayores de 10 MiB, empates de revisión y descargas fallidas quedan sin decidir. Se leen como máximo tres archivos de imagen a la vez entre cuentas, con cola por orden de llegada y límite de tres segundos incluyendo la espera. El cruce de imágenes dispone de hasta cuatro segundos y reserva un segundo del plazo general para conservar los enlaces de video confirmados. Primero se comprueban los archivos candidatos; los tamaños de cabeceras remotas solo evitan descargar imágenes incompatibles, nunca prueban identidad. El plazo general por defecto es ocho segundos. Las cabeceras y huellas confirmadas del CDN se conservan en cachés acotadas a 1.000 URLs por proceso para que las siguientes ejecuciones avancen sobre el historial ya comprobado; no se almacenan fallos como evidencia. El cruce es de mejor esfuerzo dentro del plazo, no una prueba exhaustiva de todas las publicaciones históricas. El origen se lee desde su cuenta R2 configurada; la copia remota solo desde HTTPS en `static.metricool.com`, sin redirecciones. No se borran medios ni publicaciones.

Antes de enlazar una imagen se vuelve a consultar la revisión actual; esto reduce la ventana de cambio de archivo, pero no es una transacción atómica con una carga simultánea. La escritura conserva las guardas existentes de envío y enlace; las escrituras de verificación se ensayaron con mocks.

Revisión de 643 del 18 de octubre de 2026: historial accesible de Metricool del 1 de agosto al 18 de octubre, 14 registros (12 publicados y 2 borradores), todos MP4. Las seis ideas ya enlazadas estaban excluidas. No se encontró identidad de publicación para las siete PNG pendientes, por lo que siguen visibles. Esto no prueba ausencia en redes o períodos fuera del historial consultado. Durante la revisión, Eric creó dos borradores desde el calendario («Pasta y calzone», 399343337, y «Miércoles», 399343747); quedaron cinco PNG pendientes y dos borradores visibles en el calendario. Estos borradores no se confunden con publicaciones ni se borran.

Comprobar con `lib/recibo/match-published-images.test.ts`, `image-fingerprint.test.ts`, `sync-published.test.ts` y `match-published.test.ts`; aviso de actualización en `components/recibo/recibo-published-sync.test.tsx`. Vista previa: `/previews/v5.142-recibo-published.html`.


### Última fecha del contenido actual (v5.143)

Eric, 18 de octubre de 2026: el calendario debe destacar hasta qué día llegarían las publicaciones con el contenido actual. La fecha final combina borradores futuros, publicaciones programadas y sugerencias de las piezas pendientes del cliente seleccionado. Los borradores reservan sus fechas, igual que las publicaciones, para evitar proyectar contenido adicional encima. Los conteos separan pendientes, borradores y publicaciones programadas; un borrador no se presenta como publicación automática.

Se verifica un horizonte de 366 días desde hoy en Puerto Rico, mediante consultas de hasta 35 días e incluyendo fechas posteriores al fin de la cola pendiente. Esto permite mostrar la última publicación programada o borrador aunque no queden piezas pendientes. Los posts se deduplican por cuenta e ID y solo se aceptan los de la cuenta y cliente consultados. Estados desconocidos, errores, publicaciones parciales y fechas pasadas no se cuentan como contenido futuro confirmado; las publicaciones publicadas/parciales sí reservan su día para la proyección. Las piezas sin frecuencia compatible permanecen «Sin fecha». La fecha es el último día previsto, no una garantía de que todos los días intermedios tengan contenido, ni de fechas posteriores al horizonte consultado.

Si falla cualquier tramo o una cuenta devuelve datos incompletos, no se afirma la fecha final. Al actualizar se indica «Verificando» mientras se conservan los reproductores; cambiar de cliente cancela la consulta anterior. «Ver última fecha» navega hasta la fecha calculada y mantiene el cliente seleccionado. No se cambia la frecuencia ni se crean publicaciones mediante este cálculo.

Evidencia de lectura de 643 del 18 de octubre de 2026: cinco gráficas pendientes, dos borradores (23 y 28 de octubre), cero publicaciones programadas futuras; frecuencia lunes/miércoles/viernes a las 10:00. Las sugerencias ocupan 19, 21, 26 y 30 de octubre y 2 de noviembre: última fecha prevista **lunes, 2 de noviembre de 2026**. Esta lectura no constituye una nueva programación. Verificación visual local y lecturas reales; las escrituras de calendario no se ensayaron con datos reales.

Pruebas: `lib/recibo/calendar-coverage.test.ts`, `lib/recibo/use-calendar-projection.test.tsx`, `lib/recibo/calendar-projection.test.ts` y `components/published/content-calendar.projection.test.tsx`. Vista previa: `/previews/v5.143-calendar-coverage.html`.

### Formato visible en el calendario (v5.144)

Eric, 18 de octubre de 2026: identificar si la pieza es Post o Reel dentro de la tarjeta del calendario. Las piezas pendientes muestran una etiqueta «Post» para imágenes y «Reel» para videos, usando la clasificación existente del archivo editado actual, tanto en fechas proyectadas como en «Sin fecha». La etiqueta permanece separada del estado de aprobación y de «Proyectado»; no modifica fechas ni crea borradores. Este alcance no inventa formatos para registros externos de Metricool sin datos suficientes.

Verificar con `components/published/content-calendar.projection.test.tsx`: gráfica y video proyectados identificados en sus propias tarjetas, aprobación conservada y etiqueta única en piezas sin fecha. Vista previa: `/previews/v5.144-calendar-format.html`.


### Semanas restantes de contenido (v5.146)

Eric, 18 de octubre de 2026: en modo «Semana» se muestra la duración restante hasta la última fecha verificada del contenido actual. El cálculo usa hoy en Puerto Rico, independientemente de la semana visible. Cuenta semanas completas más días restantes: del 18 de octubre al 2 de noviembre son «2 semanas y 1 día más de contenido», sin contar hoy como un día adicional ni redondear hacia arriba. Menos de una semana se expresa en días; una fecha final de hoy muestra «Contenido hasta hoy».

Reutiliza la cobertura verificada de pendientes compatibles, borradores y publicaciones programadas, conservando fecha final y conteos. Es tiempo hasta la última fecha, no una promesa de llenar cada día o cada semana. La duración se oculta mientras se verifica, ante datos incompletos o errores y cuando no existe fecha futura. Las piezas sin fecha compatible mantienen su explicación independiente. Cambiar la semana visible no cambia la duración; cambiar cliente o frecuencia vuelve a verificar la cobertura.

Evidencia: `lib/recibo/calendar-coverage.test.ts` (días, semanas, hoy, pasado y fechas inválidas), `components/published/content-calendar.projection.test.tsx` (solo Semana, navegación, horizonte posterior a cinco semanas, estados sin fecha/verificación/error). Vista previa: `/previews/v5.146-calendar-weeks.html`.
