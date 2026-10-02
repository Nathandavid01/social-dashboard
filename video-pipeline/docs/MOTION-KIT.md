# Motion Kit

Herramienta local para componer un reloj animado sobre B-roll real. El primer preset combina esfera con profundidad, arco luminoso, números con transición vertical, entrada suave y pulsos sincronizados con tic-tac. No genera video con IA.

## Renderizar

Desde `video-pipeline`:

```sh
python3 motionkit.py motion/arecibo-clock.json media/arecibo/reloj-nueva-version.mp4
```

El JSON controla fuente, rango y velocidad del B-roll, duración, posición, radio, valores, cambio de número, tipografía, colores y ritmo/volumen del reloj. Las rutas de recursos se resuelven respecto a `video-pipeline`. No sobrescribe exports existentes.

Produce MP4 silencioso y `.motion.json` con hash y `sound_events`. Al integrarlo, sumar el inicio de la gráfica a los tiempos de estos eventos y copiarlos a `sounds` de la receta de `pipeline.py`. Imagen y audio comparten los mismos tiempos. El video de fondo intermedio queda junto al export para depuración.

## Arecibo

Números 15 y 30 únicamente; mantener la voz que dice que el tiempo puede variar. El gráfico ilustra el rango mencionado, no una cuenta regresiva real. Conservar B-roll antes de hablar, sin repetirlo en el reel, y dejar captions fuera de la gráfica. Usar una nueva versión para cada render y revisar comienzo, cambio numérico, entrada al outro y mezcla auditiva.

Actualmente incluye un preset de reloj configurable. No es un editor general de animación ni render 3D. Puede reutilizarse con otra paleta, fuente, rango y B-roll mediante un nuevo JSON.

Transiciones: `entry_duration` (0.38 s predeterminado) y `exit_duration` (0.4 s) controlan zoom, desplazamiento y opacidad del reloj y su sombra. El fondo permanece continuo; la última imagen deja el B-roll limpio antes del outro.

## Escenas De Servicios

`service_scenes.py` genera escenas tridimensionales ilustradas (casa y maletín, cama, centro, cultivo y recipiente) con proyección ortográfica, iluminación y z-buffer. `prepare_domicilio_pro.py` las integra sobre la persona en cámara con sombras, entrada/salida y numeración. Preservar margen entre rostro, tarjeta y captions; inspeccionar todas las escenas porque la cámara del original se mueve. La gráfica es ilustrativa y no sustituye prueba de una visita real.
