-- Migration 0039: seed the weekly production cadence per client from the
-- current production calendar (R = Reel, P = Post; day_of_week 1=Mon..7=Sun).
-- Matches existing clients by name (case-insensitive); unmatched names are
-- skipped by the inner join. Idempotent via ON CONFLICT DO NOTHING.
insert into public.production_schedules (client_id, day_of_week, content_type)
select c.id, v.day_of_week, v.content_type
from (values
  ('612 C. Lounge',2,'P'),('612 C. Lounge',4,'P'),('612 C. Lounge',6,'P'),
  ('Casita Vieja',1,'R'),('Casita Vieja',2,'P'),('Casita Vieja',3,'R'),('Casita Vieja',4,'P'),('Casita Vieja',5,'R'),
  ('El Truco de Guin',1,'R'),('El Truco de Guin',3,'R'),('El Truco de Guin',5,'R'),
  ('El Cuarto Bate Bar and Rest',1,'R'),('El Cuarto Bate Bar and Rest',2,'R'),('El Cuarto Bate Bar and Rest',3,'R'),('El Cuarto Bate Bar and Rest',4,'R'),('El Cuarto Bate Bar and Rest',5,'R'),('El Cuarto Bate Bar and Rest',6,'R'),
  ('La Guarapera',2,'R'),('La Guarapera',4,'R'),('La Guarapera',7,'R'),
  ('Familia Pelaez',1,'R'),('Familia Pelaez',4,'R'),('Familia Pelaez',6,'R'),
  ('Farmacia Tierras Nuevas',4,'R'),
  ('Farmacia Buena Vida',1,'R'),('Farmacia Buena Vida',3,'R'),('Farmacia Buena Vida',5,'R'),
  ('Dr. Rodriguez Caribbean Shoulder and Elbow Institute',1,'R'),('Dr. Rodriguez Caribbean Shoulder and Elbow Institute',3,'P'),('Dr. Rodriguez Caribbean Shoulder and Elbow Institute',5,'R'),
  ('Beyond PVC Cabinets and Closets',2,'R'),('Beyond PVC Cabinets and Closets',3,'P'),('Beyond PVC Cabinets and Closets',5,'R'),
  ('VSS Properties',2,'R'),('VSS Properties',6,'R'),
  ('Lumavi Properties',1,'R'),('Lumavi Properties',2,'R'),('Lumavi Properties',3,'R'),('Lumavi Properties',4,'R'),('Lumavi Properties',5,'R'),
  ('RP Sports',3,'R'),
  ('Quantika',2,'R'),('Quantika',4,'P'),('Quantika',6,'R'),
  ('Restauco Leather and Tops',1,'R'),('Restauco Leather and Tops',2,'R'),('Restauco Leather and Tops',4,'R'),('Restauco Leather and Tops',5,'R'),
  ('Tu Cerrajero Puerto Rico',2,'P'),('Tu Cerrajero Puerto Rico',4,'P'),('Tu Cerrajero Puerto Rico',6,'P'),
  ('Geovanny Alamo',2,'R'),('Geovanny Alamo',3,'R'),('Geovanny Alamo',5,'R'),
  ('Profamilias',1,'R'),('Profamilias',2,'P'),('Profamilias',3,'R'),('Profamilias',4,'P'),('Profamilias',5,'R'),
  ('Nanas Playhouse',1,'P'),('Nanas Playhouse',3,'R'),('Nanas Playhouse',6,'R'),
  ('La Guira',1,'R'),('La Guira',3,'R'),('La Guira',5,'R'),
  ('Arasibo Steakhouse',2,'R'),('Arasibo Steakhouse',4,'R'),('Arasibo Steakhouse',6,'R'),
  ('Dorta Pizza',2,'R'),('Dorta Pizza',5,'R'),('Dorta Pizza',6,'P'),
  ('Codepola',1,'R'),('Codepola',3,'R'),('Codepola',5,'R'),
  ('Tito Rios',1,'R'),('Tito Rios',3,'R'),('Tito Rios',4,'R'),
  ('Arte Digital Online',1,'P'),('Arte Digital Online',2,'R'),('Arte Digital Online',3,'P'),('Arte Digital Online',4,'R'),('Arte Digital Online',5,'P'),('Arte Digital Online',6,'R'),
  ('Lucky Pet',1,'R'),('Lucky Pet',2,'P'),('Lucky Pet',3,'R'),('Lucky Pet',4,'P'),('Lucky Pet',5,'R'),
  ('Futones Por Sangit',2,'R'),('Futones Por Sangit',4,'R'),('Futones Por Sangit',6,'P'),
  ('Mia Pizzeria',1,'R'),('Mia Pizzeria',2,'P'),('Mia Pizzeria',3,'R'),('Mia Pizzeria',4,'P'),('Mia Pizzeria',5,'R'),
  ('Shooters Sports Armory',2,'R'),('Shooters Sports Armory',4,'R'),
  ('Dorado del Mar Club',2,'R'),('Dorado del Mar Club',4,'R'),
  ('Predator Gaming Center',2,'R'),('Predator Gaming Center',5,'R'),
  ('Speedy Net',1,'R'),('Speedy Net',3,'P'),('Speedy Net',5,'R'),
  ('New York',3,'R'),('New York',6,'R'),
  ('La Rambla Tapas y Vino',3,'R'),('La Rambla Tapas y Vino',5,'R'),
  ('Go-Kart',3,'R'),('Go-Kart',5,'R'),
  ('Ely Rosa Sportwear',1,'R'),('Ely Rosa Sportwear',3,'P'),('Ely Rosa Sportwear',5,'R')
) as v(name, day_of_week, content_type)
join public.clients c on lower(c.name) = lower(v.name)
on conflict (client_id, day_of_week, content_type) do nothing;

notify pgrst, 'reload schema';
