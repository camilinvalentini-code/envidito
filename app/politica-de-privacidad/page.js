import LegalDoc from "../../components/LegalDoc";

export const metadata = {
  title: "Política de Privacidad — Envidito",
  description: "Política de Privacidad de Envidito.",
};

const SECTIONS = [
  {
    n: 1,
    title: "Responsable del tratamiento de datos",
    body: [
      "El responsable del tratamiento de los datos personales recopilados mediante Envidito es: Camilo Valentini.",
      "Email de contacto: torneotruco.cba+envidito@gmail.com",
      "Esta Política de Privacidad explica qué datos recopila Envidito, para qué los utiliza y qué derechos tienen los usuarios sobre su información.",
    ],
  },
  {
    n: 2,
    title: "Datos que recopila Envidito",
    body: ["Envidito recopila únicamente los datos necesarios para el funcionamiento de la plataforma."],
  },
  {
    n: 3,
    title: "Datos de organizadores",
    body: [
      "De los organizadores, Envidito podrá recopilar:",
      {
        list: [
          "Nombre del bar, establecimiento u organizador.",
          "Dirección de correo electrónico.",
          "Contraseña, en caso de que el organizador cree una cuenta.",
          "Información de torneos creados.",
          "Datos cargados dentro de cada torneo.",
        ],
      },
      "Las contraseñas deberán ser almacenadas mediante mecanismos técnicos de seguridad razonables.",
    ],
  },
  {
    n: 4,
    title: "Datos de jugadores o participantes",
    body: [
      "De los jugadores o participantes, Envidito podrá recopilar:",
      {
        list: [
          "Nombre, apodo o identificación cargada por el organizador.",
          "Código de acceso asociado al equipo.",
          "Resultados o puntos vinculados a partidas.",
          "Información relacionada con la participación en torneos.",
          "Cuando el jugador se anota directamente en un torneo (sin necesidad de cuenta): DNI, teléfono, fecha de nacimiento y correo electrónico, para poder identificarlo y, eventualmente, contactarlo por premios u otras cuestiones vinculadas al torneo.",
        ],
      },
      "Los jugadores no necesariamente crean una cuenta propia en Envidito.",
      "Un equipo anotado directamente por un jugador queda pendiente de confirmación por parte del organizador del torneo antes de participar del sorteo.",
    ],
  },
  {
    n: 5,
    title: "Datos que Envidito no recopila actualmente",
    body: [
      "Actualmente Envidito no recopila:",
      {
        list: [
          "Fotos de perfil.",
          "Imágenes subidas por usuarios.",
          "Datos bancarios de jugadores.",
          "Pagos de inscripciones dentro de la plataforma.",
          "Datos sensibles como salud, religión, ideología política u otros datos especialmente protegidos.",
        ],
      },
    ],
  },
  {
    n: 6,
    title: "Finalidad del uso de los datos",
    body: [
      "Envidito utiliza los datos recopilados para:",
      {
        list: [
          "Crear y administrar cuentas de organizadores.",
          "Permitir el acceso de organizadores a la plataforma.",
          "Gestionar torneos de truco.",
          "Cargar jugadores o equipos.",
          "Generar cruces.",
          "Registrar resultados.",
          "Permitir el seguimiento del torneo.",
          "Generar enlaces únicos de acceso.",
          "Enviar comunicaciones operativas relacionadas con el servicio.",
          "Brindar soporte técnico o administrativo.",
          "Mejorar y mantener la plataforma.",
        ],
      },
    ],
  },
  {
    n: 7,
    title: "Correos electrónicos",
    body: [
      "Envidito podrá enviar correos electrónicos vinculados al uso de la plataforma, incluyendo:",
      {
        list: [
          "Emails de registro.",
          "Emails de activación o verificación de cuenta.",
          "Comunicaciones necesarias para el funcionamiento del servicio.",
          "Respuestas a consultas de soporte.",
        ],
      },
    ],
  },
  {
    n: 8,
    title: "Enlaces únicos y códigos de acceso",
    body: [
      "Envidito puede generar enlaces únicos para acceder a torneos o partidas.",
      "Dichos enlaces pueden ser enviados por los organizadores a través de medios externos, como WhatsApp u otros canales.",
      "El acceso de jugadores puede requerir un código de 4 dígitos asociado a un equipo.",
      "El organizador es responsable de compartir dichos enlaces y códigos únicamente con las personas correspondientes.",
    ],
  },
  {
    n: 9,
    title: "Datos cargados por organizadores",
    body: [
      "Los organizadores pueden cargar nombres de jugadores, equipos y otra información necesaria para gestionar un torneo.",
      "El organizador es responsable de informar a los participantes que sus datos podrán ser cargados y tratados en Envidito para la gestión del torneo.",
      "Envidito no verifica de forma independiente la exactitud de los datos cargados por los organizadores.",
    ],
  },
  {
    n: 10,
    title: "Visualización de información del torneo",
    body: [
      "La información de torneos, cruces, equipos, jugadores o resultados podrá ser visible para quienes accedan mediante enlaces generados por la plataforma.",
      "Si un organizador comparte un enlace con terceros, esos terceros podrían acceder a la información disponible en dicho enlace.",
      "Envidito no se responsabiliza por la difusión de enlaces realizada por organizadores o participantes.",
    ],
  },
  {
    n: 11,
    title: "Pagos y datos económicos",
    body: [
      "Actualmente Envidito no procesa pagos de inscripciones de jugadores.",
      "Los pagos entre organizadores y jugadores, si existieran, se realizan fuera de la plataforma.",
      "Por este motivo, Envidito no recopila ni almacena datos bancarios, tarjetas de crédito u otros datos de pago de jugadores vinculados a inscripciones.",
      "Si en el futuro Envidito incorporase pagos dentro de la plataforma, esta Política de Privacidad deberá ser actualizada.",
    ],
  },
  {
    n: 12,
    title: "Conservación de datos",
    body: [
      "Envidito conservará los datos mientras sean necesarios para:",
      {
        list: [
          "Mantener activa la cuenta del organizador.",
          "Gestionar torneos.",
          "Conservar información operativa de la plataforma.",
          "Atender consultas o reclamos.",
        ],
      },
      "Los datos podrán eliminarse cuando dejen de ser necesarios o cuando el usuario lo solicite, salvo que exista una obligación o motivo legítimo para conservarlos.",
    ],
  },
  {
    n: 13,
    title: "Eliminación o modificación de datos",
    body: [
      "Los organizadores podrán solicitar:",
      {
        list: [
          "Corrección de datos incorrectos.",
          "Eliminación de su cuenta.",
          "Eliminación de datos asociados, cuando corresponda.",
        ],
      },
      "La solicitud deberá enviarse a: torneotruco.cba+envidito@gmail.com",
      "Hasta que exista una funcionalidad automática dentro de la plataforma, estas solicitudes se gestionarán por correo electrónico.",
    ],
  },
  {
    n: 14,
    title: "Seguridad de la información",
    body: [
      "Envidito adopta medidas razonables para proteger la información almacenada y evitar accesos no autorizados, pérdida, alteración o uso indebido de los datos.",
      "Sin embargo, ningún sistema informático es completamente seguro.",
      "Por ello, Envidito no puede garantizar una seguridad absoluta frente a incidentes técnicos, accesos no autorizados o fallos externos.",
    ],
  },
  {
    n: 15,
    title: "Servicios de terceros",
    body: [
      "Envidito podrá utilizar servicios de terceros necesarios para operar la plataforma, tales como:",
      {
        list: [
          "Servicios de hosting.",
          "Servicios de base de datos.",
          "Servicios de email.",
          "Repositorios de código.",
          "Herramientas técnicas necesarias para el funcionamiento del sitio.",
        ],
      },
      "Estos terceros podrán tratar datos únicamente en la medida necesaria para prestar sus servicios técnicos.",
    ],
  },
  {
    n: 16,
    title: "Transferencia o comunicación de datos",
    body: [
      "Envidito no vende, alquila ni comercializa datos personales de usuarios.",
      "Los datos solo podrán compartirse cuando:",
      {
        list: [
          "Sea necesario para operar la plataforma.",
          "Lo requiera una obligación legal.",
          "Sea necesario para resolver incidencias técnicas.",
          "Sea necesario para proteger derechos de Envidito o de terceros.",
        ],
      },
    ],
  },
  {
    n: 17,
    title: "Derechos de los usuarios",
    body: [
      "Los usuarios tienen derecho a solicitar información sobre sus datos personales, pedir correcciones, actualizaciones o eliminación, conforme a la normativa aplicable de protección de datos personales en Argentina. La Ley 25.326 define y protege los datos personales y regula su tratamiento en bases de datos públicas o privadas.",
      "Las solicitudes deberán enviarse a: torneotruco.cba+envidito@gmail.com",
    ],
  },
  {
    n: 18,
    title: "Menores de edad",
    body: [
      "Envidito no está especialmente dirigida a menores de edad.",
      "Si un organizador carga información de participantes menores de edad, será responsabilidad del organizador contar con las autorizaciones necesarias, cuando correspondan.",
    ],
  },
  {
    n: 19,
    title: "Cambios en esta Política de Privacidad",
    body: [
      "Envidito podrá modificar esta Política de Privacidad en cualquier momento.",
      "Las modificaciones serán publicadas en la plataforma y entrarán en vigor desde su publicación.",
      "El uso continuado de Envidito luego de publicadas las modificaciones implica la aceptación de la nueva Política de Privacidad.",
    ],
  },
  {
    n: 20,
    title: "Contacto",
    body: [
      "Para consultas, solicitudes o reclamos relacionados con privacidad y tratamiento de datos personales, el usuario podrá comunicarse a: torneotruco.cba+envidito@gmail.com",
    ],
  },
];

export default function PoliticaPrivacidadPage() {
  return <LegalDoc title="Política de Privacidad de Envidito" lastUpdated="14/08/2026" sections={SECTIONS} />;
}
