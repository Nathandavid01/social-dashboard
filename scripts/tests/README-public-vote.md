# Voto Público — Pruebas Locales

Usar una base PostgreSQL vacía aislada, nunca Supabase. Los roles anon y authenticated deben existir. El fixture es mínimo, no replica todo el esquema ni las políticas de producción.

Ejecutar con `psql -v ON_ERROR_STOP=1`:

1. `public-vote-fixture.sql`.
2. `../../supabase/migrations/0076_guard_client_review_after_posting.sql`.
3. `public-vote-assertions.sql`.
4. `public-vote-sent-assertions.sql`.

Las assertions usan rollback. La primera valida retorno a revision_needed, comentario, voto único y rollback si falla insertar actividad. La segunda verifica que un video enviado no cambia de estado ni registra voto.

Baseline: la función de la migración 0055 pasó las pruebas de transacción, pero falló la prueba de video enviado: devolvió ok:true y rejected. La 0076 añade bloqueo de idea y guardias de envío/cierre. Se probó localmente con PostgreSQL 16; no está aplicada en Supabase.

Se ejecutaron también diez procesos psql simultáneos como anon con votos alternos approved/rejected sobre la misma fila: uno aceptado y nueve ya_votado. Esa prueba persiste un voto exclusivamente en la base local nate_public_vote_test; usar un fixture nuevo antes de repetir el conjunto.

Pendiente antes de aplicación: validar con el esquema real, verificar coordinación con la publicación y reemplazo de enlaces, mapear video_ya_enviado a un mensaje claro para el cliente, comprobar el archivo exacto que vio el cliente y el circuito completo. 0076 usa el mismo nombre RPC: aplicarla cambia inmediatamente el voto público, aunque no se haya desplegado la aplicación.
