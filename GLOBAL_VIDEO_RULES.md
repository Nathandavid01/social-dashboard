# Reglas globales de edición de video

Confirmadas por Nathan el 2026-10-12. Alcance: todos los clientes y todos los trabajos de edición de video del repositorio y de Nate Video Pipeline, no solamente CHEESY.

Leer estas reglas antes de preparar una receta, editar o revisar un video. Son instrucciones editoriales obligatorias para el flujo de trabajo; este documento no instala validación automática en el motor.

## Encuadre y texto

1. **Zona de los ojos.** Mantener los ojos en la misma zona de la imagen tanto como sea posible entre planos y zooms. Romper esta continuidad solo cuando el crudo no permita conservarla; documentar la limitación. Debe ser la excepción, no la regla.
2. **Persona centrada.** Mantener a la persona en el centro o cerca del centro. Cuando haga falta, usar keyframes de tamaño y posición para corregir movimientos involuntarios y eliminar espacio muerto (techo, paredes o personas ajenas). Respetar los encargos que indiquen no modificar el encuadre del crudo.
3. **Nunca poner texto sobre los ojos.** Aplica a subtítulos, hooks, títulos y cualquier otro texto, también durante transiciones y reencuadres.
4. **Subtítulos consistentes.** Si se usa una línea, mantener siempre la misma posición. Si se usan dos líneas, definir un interlineado compacto explícito, sin aceptar automáticamente el espaciado por defecto de la fuente. Comprobar que las líneas estén cercanas, legibles y sin solaparse; mantener estable el anclaje del bloque.

## Zooms y cortes

5. **Zoom de énfasis mediante cortes limpios, no animación.** Al nombrar un plato o decir algo importante, cortar a una escala de 20–30 puntos porcentuales por encima de la escala base; al terminar la idea, volver mediante otro corte a la escala base. Ejemplo: 100% → 120–130% → 100%. No usar keyframes para animar este zoom in/out. Los keyframes correctivos de encuadre de la regla 2 sí están permitidos: no confundir estabilización/reencuadre con zoom de énfasis.
6. **Entrada y salida de B-roll.** Hacer la entrada de todos los B-rolls con disolución de película: opacidad de 0 a 100% en 8–12 frames sobre la toma base. Retirarlos con un corte normal, sin fade de salida. El material de apoyo debe corresponder a la frase o evento mostrado; su duración la determina el encargo, no una duración universal tomada de un video particular.
7. **Recortes de silencios o ideas abandonadas.** Suavizar el salto de posición de la persona con una disolución cruzada corta de 4–6 frames como máximo. No extenderla ni cortar sílabas o palabras para acomodarla. Esta disolución correctiva no sustituye los cortes limpios del zoom de énfasis ni la salida de B-roll.

Los rangos se miden en frames de la línea de tiempo de salida, no en una duración fija en segundos. A 30 fps: 8–12 frames son aproximadamente 0.267–0.400 s y 4–6 frames son aproximadamente 0.133–0.200 s. Ajustar la conversión al fps real y verificar los límites en el render.

## Alcance, precedencia y marca

- Estas reglas sustituyen recomendaciones generales anteriores que permitan zooms de énfasis animados, texto sobre los ojos o transiciones incompatibles.
- Fuente, color, tamaño de texto, logos, outro, música, copy y presencia de hook siguen el perfil del cliente y el encargo vigente. Comic Sans, amarillo, el hook de CHEESY y el B-roll de un segundo de esas piezas no se convierten en requisitos para todos los clientes.
- No inferir excepciones desde una receta vieja, una plantilla o un preset. Cualquier excepción editorial solicitada explícitamente debe quedar documentada con fecha y alcance; una limitación del crudo solo justifica la excepción de encuadre correspondiente.
- Conservar las reglas vigentes no contradictorias de preguntas/respuestas, voz original, inteligibilidad, selección de tomas, cierre y revisión. En revisiones puntuales, preservar lo aprobado y exportar una nueva versión.

## Checklist de revisión

- [ ] Ojos estables entre cambios de escala, o limitación del crudo documentada.
- [ ] Persona centrada y espacio muerto corregido cuando corresponda.
- [ ] Ningún texto sobre los ojos en ninguna toma ni transición.
- [ ] Subtítulos con anclaje estable e interlineado compacto explícito.
- [ ] Énfasis con cortes de +20–30 puntos y regreso a escala base, sin zoom animado.
- [ ] Cada B-roll entra con opacidad 0→100% en 8–12 frames y sale a corte.
- [ ] Recortes de silencios/ideas con disolución de 4–6 frames como máximo y palabras completas.
- [ ] Estilo del cliente y decisiones específicas del encargo preservados.
- [ ] Revisar el render y las transiciones; separar QA técnico, revisión visual, escucha real y aprobación del usuario. Un encode correcto no constituye aprobación.

## Sincronización entre repositorios

Este mismo documento se mantiene en `GLOBAL_VIDEO_RULES.md` de `Nathandavid01/social-dashboard` y `ericmperez/nate-video-pipeline`. Cuando una instrucción confirmada cambie estas reglas globales, actualizar ambas copias en la misma tarea y comprobar que su contenido coincida. No hay sincronización automática.
