# Laboratorio De Efectos

Abrir `http://127.0.0.1:3046/effects/index.html`, también enlazado desde la galería de Nana’s.

## Uso

1. Escuchar o ver una muestra; pulsar **Elegir**.
2. Indicar el segundo, la duración, la intensidad y el volumen si aplica.
3. Añadir eventos y exportar la receta. Si el navegador integrado no descarga el archivo, **Copiar Receta** ofrece el mismo JSON.
4. Pedir a Codex que lo aplique al video indicado. La página prepara instrucciones; la aplicación y el render se ejecutan con las herramientas locales.

Las previsualizaciones usan valores predeterminados. Cambiar los controles modifica la receta, no vuelve a generar la muestra. La escucha crítica de la mezcla final sigue siendo necesaria.

## Herramientas

Desde la carpeta `video-pipeline`:

```sh
python3 effectkit.py list
python3 effectkit.py sound mouse_click media/click-nuevo.wav --gain-db -12
python3 effectkit.py studio
python3 effectkit.py apply edits/practico-v11.json mi-receta.json edits/practico-efectos.json
python3 pipeline.py render edits/practico-efectos.json runs/practico-efectos.mp4
```

`apply` crea una receta nueva en la misma carpeta que la original para conservar las rutas relativas; no modifica el original. `render` rechaza exportaciones existentes. La galería vigente sólo cambia mediante una actualización explícita de sus versiones.

Ejemplo de receta exportada:

```json
{
  "events": [
    {"preset":"mouse_click","time":4.64,"duration":0.09,"gain_db":-12},
    {"preset":"soft_zoom","time":2,"duration":1.2,"intensity":0.5}
  ],
  "broll_fades": [{"index":1,"fade_in":0.12,"fade_out":0.12}]
}
```

En la interfaz las tomas comienzan en 1; en JSON `index` comienza en 0. El índice se refiere al arreglo completo `broll` de la receta, incluidas gráficas o capas de presentador. Comprobar la toma antes de aplicar.

## Catálogo

- Sonidos: mouse, teclado, pop, whoosh suave, deslizamiento, impacto, campanilla, destellos y caída de logo.
- `whoosh_sweep`: aire filtrado de ataque rápido (pico de envolvente al 20%) y caída breve; duración base 0.32 s. Para anticipar un corte por 50 ms, iniciar 114 ms antes del corte. No es una muestra extraída ni una coincidencia auditiva confirmada.
- `whip_pan`: barrido lateral de 0.20 s centrado en un corte real, con bordes reflejados y desenfoque horizontal. Se aplica antes de los captions, que conservan su posición y nitidez.
- Efectos: zoom de énfasis y zoom suave, ambos regresan al encuadre original.
- Transiciones: desenfoque breve, negro y regreso, destello suave; fundido real de entrada/salida del B-roll sobre la imagen inferior.
- Parámetros: intensidad 0.1–1, volumen −45 a −12 dB, duración 0.04–4 segundos. El fundido de B-roll admite como máximo 1 segundo y nunca más de media toma.

`effects.py` es la definición única de presets y síntesis. `pipeline.py` acepta `sounds[].preset`, `effects[]` y `broll[].fade_in/fade_out`. Las recetas antiguas mantienen sus sonidos y transiciones sin reinterpretarlos. Los efectos visuales se aplican antes de captions y números para que sigan legibles.

## Reglas De Nana’s

Usar efectos con intención: click al enumerar, fundidos breves cuando ayudan al corte y zoom moderado para énfasis. No apilar efectos que compitan con la voz, tapar caras o duplicar el sonido del outro oficial. Registrar nuevas preferencias en AGENTS.md/perfiles, manteniendo validación y revisión de cada exportación.

Los sonidos del kit se sintetizan localmente sin muestras de terceros. Las previsualizaciones con metraje de Nana’s son locales y no equivalen a autorización de publicación. No se ha confirmado similitud auditiva con ningún sonido viral específico.

## Gráficas De Listas Animadas

`python3 motion_cards.py edits/practico-motion-v14.json`

Genera clips verticales 1080×1920/30 fps con entradas suaves, números, iconos y logo oficial. Plantillas: `hook`, `clean`, `home`, `broll`. Requiere Pillow y FFmpeg; no usa servicios externos. Cada escena define `template`, `duration`, `output`; B-roll añade `source` y `source_in`. Los archivos existentes se conservan: usar nuevos nombres de salida al iterar.

Añadir los clips a `broll` en una receta nueva y renderizar con `pipeline.py`. Los captions y mezcla se aplican allí. En clips derivados de tomas reales conservar `original_source`, `source_in`, `source_out`; las gráficas puras llevan `kind: brand_graphic`. Esto evita que una composición cuente como B-roll nuevo. Revisar movimiento, texto, sincronización y resultado completo antes de actualizar la galería.
