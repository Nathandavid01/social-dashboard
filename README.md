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

### Calendario de publicaciones (v5.127)

En `/home`, el calendario muestra los posts existentes en Metricool en vistas de mes y semana, con miniaturas, horarios de Puerto Rico y filtros por cliente y estado. El panel derecho reúne próximas publicaciones, conteos por estado y posts que necesitan atención.

Abre una tarjeta para ver el caption, el estado por red y los enlaces disponibles. **Publicado** requiere que todas las redes estén en `PUBLISHED`; una publicación parcial, un error o un estado sin confirmar permanece identificado. **Verificar** consulta Metricool de nuevo; la actualización automática se ejecuta cada minuto mientras el calendario está visible. Si una cuenta falla, el calendario advierte que la verificación y los conteos están incompletos.

Con permiso `metricool.write`, abre un post pendiente y elige **Guardar como borrador** para desactivar su publicación automática. Con ese permiso y `posting.publish`, elige una fecha y hora futuras en Puerto Rico (UTC−4) y pulsa **Programar** para activar la publicación automática del mismo post. Los posts publicados en una o más redes conservan su historial y no se pueden reprogramar desde estos controles.

Cada cambio vuelve a leer el post y después consulta Metricool para comprobar el resultado. Si aparece **Cambio pendiente de verificar** o falla la conexión tras enviar, usa **Verificar calendario** antes de repetir la acción. La validación de esta entrega incluye escrituras simuladas y consultas reales de lectura; no se probaron cambios reales de programación. Ver [notas de implementación](CLAUDE.md#calendario-de-publicaciones).

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
