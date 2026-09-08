# Prueba Aislada De Revisión Atómica

Usar una base PostgreSQL vacía de prueba, nunca producción. El fixture crea roles y tablas mínimas, no replica todo el esquema/RLS real.

En orden, con `psql -v ON_ERROR_STOP=1 -f <archivo>` y conexión a esa base:

1. `scripts/tests/review-atomic-fixture.sql`
2. `supabase/migrations/0074_atomic_internal_review.sql`
3. `scripts/tests/review-atomic-assertions.sql`

Las assertions usan transacciones con rollback. Una instancia vacía nueva es necesaria para repetir el fixture.

Validan guardias y rollback de estado/historia. La validación de integración con el esquema y roles reales de Supabase sigue siendo obligatoria antes de activar el RPC.
