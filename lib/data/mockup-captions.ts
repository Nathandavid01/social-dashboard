export interface CaptionExample {
  id: number
  client: string
  industry: string
  platform: 'Instagram' | 'TikTok' | 'Facebook' | 'Twitter/X'
  type: 'promotional' | 'engagement' | 'educational' | 'testimonial' | 'announcement'
  caption: string
}

export const mockupCaptions: CaptionExample[] = [
  {
    id: 1,
    client: 'Brisa Salon & Spa',
    industry: 'Belleza',
    platform: 'Instagram',
    type: 'promotional',
    caption: `Tu cabello merece lo mejor y lo sabes.

Este mes tenemos 20% de descuento en todos los tratamientos de keratina. Agenda tu cita antes de que se llenen los espacios.

Llama al 787-555-0101 o escribe por DM.

#BrisaSalon #KeratinaPR #CabelloSaludable #SalonDeBelleza #PuertoRico`,
  },
  {
    id: 2,
    client: 'Fogon Criollo',
    industry: 'Restaurante',
    platform: 'Instagram',
    type: 'engagement',
    caption: `Dime la verdad, con mofongo o con tostones?

Comenta tu respuesta y etiqueta a ese pana que siempre pide los dos.

Te esperamos de lunes a domingo en Santurce.

#FogonCriollo #ComidaCriolla #Mofongo #Tostones #SanturcePR #RestaurantesPR`,
  },
  {
    id: 3,
    client: 'PowerFit Gym',
    industry: 'Fitness',
    platform: 'TikTok',
    type: 'educational',
    caption: `No necesitas dos horas en el gym para ver resultados.

Con 45 minutos bien enfocados y un plan de entrenamiento correcto, puedes transformar tu cuerpo. La consistencia le gana a la intensidad siempre.

Agenda tu evaluacion gratis y empieza esta semana.

#PowerFitGym #FitnessPR #EntrenamientoPersonal #GymLife #Consistencia`,
  },
  {
    id: 4,
    client: 'Isla Legal Group',
    industry: 'Servicios Legales',
    platform: 'Facebook',
    type: 'educational',
    caption: `Sabias que tienes 30 dias para reclamar despues de un accidente de transito?

Muchas personas pierden su derecho a compensacion simplemente porque no actuan a tiempo. No dejes que te pase a ti.

Consulta gratis. Llama al 787-555-0202.

#IslaLegalGroup #AbogadosPR #AccidentesDeTransito #TusDerechos #ConsultaGratis`,
  },
  {
    id: 5,
    client: 'Caribean Realty',
    industry: 'Bienes Raices',
    platform: 'Instagram',
    type: 'announcement',
    caption: `Nueva propiedad disponible en Condado.

3 habitaciones, 2 banos, vista al mar y acceso directo a la playa. Este tipo de oportunidad no se repite.

Escribe por DM o llama para coordinar tu visita.

#CaribeanRealty #BienesRaicesPR #Condado #PropiedadEnVenta #VidaEnLaPlaya #InvierteEnPR`,
  },
  {
    id: 6,
    client: 'Nene Fresh Barbershop',
    industry: 'Barberia',
    platform: 'Instagram',
    type: 'promotional',
    caption: `El corte habla por ti antes de que digas una palabra.

Ven a Nene Fresh y sal con ese look que te tiene ready pa' lo que sea. Citas disponibles esta semana.

Reserva por DM o por telefono.

#NeneFresh #BarbershopPR #CortesDePelo #FreshCut #EstiloPR`,
  },
  {
    id: 7,
    client: 'Dulce Tentacion Bakery',
    industry: 'Panaderia',
    platform: 'Facebook',
    type: 'testimonial',
    caption: `"Pedi el bizcocho de tres leches para el cumple de mi nena y todo el mundo quedo loco. Definitivamente repito." — Maria L.

Gracias por la confianza, Maria. Nos encanta ser parte de tus momentos especiales.

Haz tu orden con 48 horas de anticipacion.

#DulceTentacion #BizcochosPR #TresLeches #PanaderiaPR #Cumpleanos`,
  },
  {
    id: 8,
    client: 'AutoPro Detailing',
    industry: 'Automotriz',
    platform: 'TikTok',
    type: 'promotional',
    caption: `Antes y despues que te va a dejar con la boca abierta.

Este Honda Civic llego con anos de uso encima y salio como nuevo. Asi trabajamos en AutoPro.

Agenda tu detailing completo. Link en bio.

#AutoPro #DetailingPR #AntesYDespues #CarDetailng #AutosCuidados`,
  },
  {
    id: 9,
    client: 'Dr. Rivera Dental',
    industry: 'Salud Dental',
    platform: 'Instagram',
    type: 'educational',
    caption: `Una limpieza dental cada 6 meses puede prevenir problemas que despues cuestan miles.

No esperes a que duela para ir al dentista. La prevencion es la mejor inversion en tu salud.

Aceptamos la mayoria de los planes medicos. Llama al 787-555-0303.

#DrRiveraDental #DentistaPR #SaludDental #Prevencion #SonrisaSaludable`,
  },
  {
    id: 10,
    client: 'Vibe Studio PR',
    industry: 'Fotografia/Videografia',
    platform: 'Instagram',
    type: 'engagement',
    caption: `Detras de cada buen contenido hay un equipo que se lo toma en serio.

Creamos contenido visual que conecta con tu audiencia y convierte seguidores en clientes. Eso es lo que hacemos.

Escribe por DM y hablamos de tu proyecto.

#VibeStudioPR #ContenidoVisual #FotografiaPR #VideografiaPR #MarketingDigital`,
  },
  {
    id: 11,
    client: 'Tropical Pets Veterinary',
    industry: 'Veterinaria',
    platform: 'Facebook',
    type: 'announcement',
    caption: `Este sabado tenemos jornada de vacunacion a precio especial.

Trae a tu mascota de 8am a 2pm a nuestra clinica en Bayamon. Sin cita previa, por orden de llegada.

Dale a tu peludito el cuidado que se merece.

#TropicalPets #VeterinariaPR #Vacunacion #MascotasPR #Bayamon`,
  },
  {
    id: 12,
    client: 'Codigo Academy',
    industry: 'Educacion/Tech',
    platform: 'Twitter/X',
    type: 'promotional',
    caption: `No necesitas un titulo de 4 anos para entrar al mundo tech.

Nuestro bootcamp de desarrollo web te prepara en 12 semanas con proyectos reales y mentorias en vivo. La proxima cohorte empieza en junio.

Aplica ahora. Link en bio.

#CodigoAcademy #TechPR #DesarrolloWeb #Bootcamp #AprendeACodificar`,
  },
  {
    id: 13,
    client: 'Sol & Arena Events',
    industry: 'Eventos',
    platform: 'Instagram',
    type: 'testimonial',
    caption: `"Nos hicieron la boda que siempre sonamos y mas. Cada detalle estuvo perfecto." — Carlos y Ana

Planificar tu evento no tiene que ser estresante. Nosotros nos encargamos de todo para que tu solo disfrutes.

Agenda tu consulta inicial sin costo.

#SolYArena #EventosPR #BodasPR #WeddingPlannerPR #Celebracion`,
  },
  {
    id: 14,
    client: 'Raices Coffee Co.',
    industry: 'Cafe/Bebidas',
    platform: 'TikTok',
    type: 'engagement',
    caption: `Cafe de Puerto Rico, hecho con orgullo boricua.

Cada taza que servimos viene de fincas locales en Adjuntas y Lares. Cuando nos visitas, estas apoyando al agricultor puertorriqueno.

Pasa por nuestra barra en Rio Piedras.

#RaicesCoffee #CafePR #CafeBoricua #Adjuntas #Lares #ApoyaLoLocal`,
  },
  {
    id: 15,
    client: 'Flex Moving PR',
    industry: 'Mudanzas',
    platform: 'Facebook',
    type: 'promotional',
    caption: `Mudarte no tiene que ser un dolor de cabeza.

En Flex Moving nos encargamos de empacar, transportar y organizar todo. Tu solo dinos a donde vas y nosotros hacemos el resto.

Cotizacion gratis. Escribe por inbox o llama al 787-555-0404.

#FlexMovingPR #MudanzasPR #Mudarte #ServiciosDeMudanza #PuertoRico`,
  },
]
