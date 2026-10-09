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

### Calendario de publicaciones (v5.130)

En **Recibos** (`/recibo`), **Calendario** es la pestaña inicial para usuarios con permiso `metricool.read` y muestra los posts existentes en Metricool en vistas de mes y semana, con miniaturas, horarios de Puerto Rico y filtros por cliente y estado. El panel derecho reúne próximas publicaciones, conteos por estado y posts que necesitan atención. La pestaña **Contenido recibido** conserva el tablero de videos y aprobaciones; cambiar de pestaña conserva las subidas pendientes del calendario. Sin permiso de lectura de Metricool, Recibos muestra directamente el contenido recibido.

El panel **Frecuencia por cliente** muestra los días por semana y el horario/tipo guardados. Las marcas punteadas **Previsto** indican los días que le toca publicar según `posting_days`, independientemente de los posts reales y del filtro de estados. Se muestran en mes y semana; el selector de cliente filtra también estas marcas. Si hay más de dos clientes previstos en un día, pulsa **+N clientes previstos** para verlos todos. Los clientes sin días válidos guardados muestran **Sin frecuencia configurada**. `posting_schedule` puede contener un horario por día o tipos heredados («reel», «post», «story»); una hora válida por día prevalece sobre `posting_time`, y los tipos conservan la hora general válida. Sin ninguna hora válida, el panel muestra **Sin hora**. No se inventan días ni horarios ni se cambian los ajustes.

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
