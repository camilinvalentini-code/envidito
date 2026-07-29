import LegalDoc from "../../components/LegalDoc";

export const metadata = {
  title: "Términos y Condiciones — Envidito",
  description: "Términos y Condiciones de uso de Envidito.",
};

const SECTIONS = [
  {
    n: 1,
    title: "Información general",
    body: [
      "Envidito es una plataforma digital destinada a la gestión y administración de torneos de truco. La plataforma es operada por Camilo Valentini, en carácter de persona física.",
      "Email de contacto: torneotruco.cba+envidito@gmail.com",
      "El uso de Envidito implica la aceptación de los presentes Términos y Condiciones.",
    ],
  },
  {
    n: 2,
    title: "Objeto de la plataforma",
    body: [
      "Envidito permite a organizadores crear, administrar y gestionar torneos de truco, incluyendo la carga de equipos o jugadores, generación de cruces, seguimiento de partidas, carga de resultados y visualización del avance del torneo.",
      "Envidito actúa únicamente como una herramienta tecnológica de gestión de torneos.",
    ],
  },
  {
    n: 3,
    title: "Tipos de usuarios",
    body: [
      "La plataforma contempla principalmente dos tipos de usuarios:",
      "a) Organizadores: son quienes crean y administran torneos dentro de Envidito.",
      "b) Jugadores o participantes: son quienes participan en los torneos creados por los organizadores.",
      "Los jugadores no necesariamente crean una cuenta en la plataforma. Su acceso puede realizarse mediante enlaces únicos y códigos de acceso generados por Envidito.",
    ],
  },
  {
    n: 4,
    title: "Registro de organizadores",
    body: [
      "Los organizadores podrán crear una cuenta utilizando una dirección de correo electrónico válida.",
      "En algunos casos, el organizador podrá acceder mediante correo electrónico y contraseña.",
      "El organizador es responsable de mantener la confidencialidad de sus credenciales de acceso.",
      "Actualmente Envidito no cuenta con una funcionalidad automática de recuperación de contraseña. Hasta que dicha funcionalidad sea implementada, cualquier inconveniente de acceso deberá gestionarse mediante el email de contacto indicado en estos Términos.",
    ],
  },
  {
    n: 5,
    title: "Datos cargados por organizadores",
    body: [
      "Los organizadores podrán cargar información necesaria para la gestión del torneo, incluyendo, entre otros:",
      {
        list: [
          "Nombre del bar, establecimiento u organizador.",
          "Correo electrónico del organizador.",
          "Nombre de jugadores y/o nombre de equipos.",
          "Resultados de partidas.",
          "Información vinculada al desarrollo del torneo.",
        ],
      },
      "El organizador declara que cuenta con autorización suficiente para cargar la información de jugadores o equipos en la plataforma.",
    ],
  },
  {
    n: 6,
    title: "Acceso de jugadores",
    body: [
      "Los jugadores podrán acceder a determinadas funcionalidades mediante un enlace único generado por la plataforma.",
      "El enlace será compartido por el organizador mediante medios externos a Envidito, como WhatsApp u otros canales de comunicación.",
      "Para ingresar, el jugador deberá introducir un código de 4 dígitos asociado a su equipo que será compartido por el organizador, mediante medios externos a Envidito, como WhatsApp u otros canales de comunicación.",
      "Envidito no controla ni se responsabiliza por la forma en que los organizadores comparten dichos enlaces/códigos.",
    ],
  },
  {
    n: 7,
    title: "Gestión de torneos",
    body: [
      "Los organizadores son responsables de:",
      {
        list: [
          "Crear torneos.",
          "Cargar jugadores o equipos.",
          "Administrar cruces.",
          "Supervisar el avance del torneo.",
          "Corregir errores de carga.",
          "Validar resultados.",
          "Reabrir mesas o el torneo cuando sea necesario.",
        ],
      },
    ],
  },
  {
    n: 8,
    title: "Resultados, errores y modificaciones",
    body: [
      "Los resultados publicados en Envidito dependen de la información ingresada por jugadores y organizadores.",
      "Envidito no garantiza que los resultados cargados sean exactos, completos, definitivos o libres de errores.",
      "Los organizadores podrán modificar resultados, puntos, cruces u otros datos del torneo cuando detecten errores o inconsistencias.",
      "Actualmente, cuando un dato es modificado, la información anterior puede ser sobrescrita y no necesariamente se conserva un historial de auditoría de cambios.",
      "El organizador es el responsable final de validar la información de su torneo.",
    ],
  },
  {
    n: 9,
    title: "Finalización y reapertura de torneos",
    body: [
      "Un torneo puede finalizar según la lógica de funcionamiento de la plataforma, por ejemplo, cuando se cumple una condición determinada del torneo.",
      "Sin perjuicio de ello, el organizador podrá reabrir el torneo cuando sea necesario corregir errores, resultados o información cargada incorrectamente.",
      "La finalización de un torneo no implica necesariamente que los datos no puedan ser corregidos posteriormente por el organizador.",
    ],
  },
  {
    n: 10,
    title: "Visualización pública de torneos",
    body: [
      "La información de los torneos gestionados mediante Envidito podrá ser visible públicamente a través del sitio web de la plataforma.",
      "Determinados datos, incluyendo equipos, jugadores, cruces, posiciones, resultados, clasificaciones y otra información vinculada a los torneos, podrán ser consultados por cualquier persona que acceda a la plataforma, sin necesidad de crear una cuenta o iniciar sesión.",
      "Adicionalmente, Envidito podrá generar enlaces específicos para facilitar el acceso a determinadas funcionalidades o vistas de los torneos.",
      "Los organizadores reconocen y aceptan que la información cargada en los torneos podrá ser visualizada públicamente dentro de la plataforma.",
      "Los organizadores son responsables de no incorporar información personal innecesaria o sensible de los participantes.",
      "Envidito podrá modificar en cualquier momento el nivel de visibilidad de determinadas funcionalidades, torneos o contenidos por razones técnicas, comerciales, operativas o de seguridad.",
    ],
  },
  {
    n: 11,
    title: "Membresías y pagos",
    body: [
      "El uso de Envidito para jugadores es gratuito.",
      "Los organizadores podrán estar sujetos a una membresía mensual de pago.",
      "Actualmente el precio de la membresía puede no estar definido o podrá ser informado oportunamente dentro de la plataforma o por los canales de contacto disponibles.",
      "Envidito podrá modificar precios, crear nuevos planes, cambiar condiciones comerciales o establecer distintas categorías de membresía en el futuro.",
      "Dichos planes podrán incluir límites o condiciones diferentes, por ejemplo:",
      {
        list: [
          "Cantidad de torneos activos.",
          "Cantidad de torneos creados.",
          "Cantidad de participantes.",
          "Funcionalidades disponibles.",
          "Beneficios adicionales para organizadores.",
        ],
      },
      "Hasta que se indique lo contrario, los organizadores podrán crear más de un torneo al mismo tiempo.",
    ],
  },
  {
    n: 12,
    title: "Pagos de inscripciones, premios y transacciones externas",
    body: [
      "Actualmente Envidito no procesa pagos de inscripciones de jugadores.",
      "Cualquier pago, inscripción, cobro, premio, acuerdo económico o transacción entre organizadores y jugadores se realiza fuera de la plataforma.",
      "Envidito no interviene, administra, garantiza ni se responsabiliza por pagos, premios, deudas, cobros, beneficios o acuerdos realizados entre usuarios.",
      "Actualmente los organizadores no pueden publicar premios directamente dentro de la plataforma.",
      "Si en el futuro se incorporan funcionalidades vinculadas a premios, inscripciones o pagos, Envidito podrá actualizar estos Términos y Condiciones.",
    ],
  },
  {
    n: 13,
    title: "Responsabilidad de los organizadores",
    body: [
      "Los organizadores son responsables por:",
      {
        list: [
          "La veracidad de la información cargada.",
          "La correcta administración del torneo.",
          "La comunicación con los jugadores.",
          "La gestión de pagos externos, si existieran.",
          "La resolución de conflictos entre participantes.",
          "El cumplimiento de las reglas propias de cada torneo.",
        ],
      },
      "Envidito no participa en la organización operativa del torneo salvo que expresamente se indique lo contrario.",
    ],
  },
  {
    n: 14,
    title: "Uso permitido de la plataforma",
    body: [
      "Los usuarios se comprometen a utilizar Envidito de forma lícita, respetuosa y conforme a estos Términos.",
      "Queda prohibido:",
      {
        list: [
          "Usar la plataforma para fines ilegales.",
          "Cargar información falsa, ofensiva o fraudulenta.",
          "Intentar acceder a cuentas o torneos ajenos sin autorización.",
          "Manipular resultados de forma indebida.",
          "Afectar el funcionamiento técnico de la plataforma.",
          "Copiar, reproducir o explotar la plataforma sin autorización.",
        ],
      },
    ],
  },
  {
    n: 15,
    title: "Disponibilidad del servicio",
    body: [
      "Envidito procurará mantener la plataforma disponible y operativa.",
      "Sin embargo, no garantiza disponibilidad permanente, continua o libre de errores.",
      "La plataforma podrá ser modificada, actualizada, interrumpida, suspendida o desactivada temporalmente por razones técnicas, comerciales, de mantenimiento o de seguridad.",
    ],
  },
  {
    n: 16,
    title: "Propiedad intelectual",
    body: [
      "La marca, el nombre, el software, el diseño, la estructura, funcionalidades, textos, código, interfaces y demás elementos vinculados a Envidito pertenecen a su titular o a quienes correspondan según la normativa aplicable.",
      "Queda prohibida la copia, reproducción, distribución, modificación, explotación comercial o uso no autorizado de Envidito o de cualquiera de sus elementos.",
      "El uso de la plataforma no otorga a los usuarios ningún derecho de propiedad intelectual sobre Envidito.",
    ],
  },
  {
    n: 17,
    title: "Eliminación de cuentas y datos",
    body: [
      "Los organizadores podrán solicitar la eliminación de su cuenta y de sus datos escribiendo a: torneotruco.cba+envidito@gmail.com",
      "Hasta que Envidito implemente herramientas automáticas de autogestión, las solicitudes de eliminación, modificación o revisión de datos deberán realizarse por correo electrónico.",
    ],
  },
  {
    n: 18,
    title: "Limitación de responsabilidad",
    body: [
      "Envidito no será responsable por:",
      {
        list: [
          "Errores en resultados cargados por usuarios.",
          "Conflictos entre organizadores y jugadores.",
          "Cancelación de torneos.",
          "Problemas derivados de pagos externos.",
          "Premios no entregados.",
          "Información incorrecta cargada por organizadores o jugadores.",
          "Uso indebido de enlaces compartidos.",
          "Pérdida de acceso por olvido de contraseña.",
          "Decisiones tomadas por organizadores en relación con sus torneos.",
          "Fallos técnicos temporales de la plataforma.",
        ],
      },
      "Envidito funciona como herramienta tecnológica y no como garante del correcto desarrollo deportivo, económico u organizativo de cada torneo.",
    ],
  },
  {
    n: 19,
    title: "Modificaciones de los Términos",
    body: [
      "Envidito podrá modificar estos Términos y Condiciones en cualquier momento.",
      "Las modificaciones serán publicadas en la plataforma y entrarán en vigor desde su publicación.",
      "El uso continuado de Envidito luego de publicadas las modificaciones implica la aceptación de los nuevos términos.",
    ],
  },
  {
    n: 20,
    title: "Contacto",
    body: [
      "Para consultas, reclamos, solicitudes o temas relacionados con estos Términos y Condiciones, el usuario podrá comunicarse a: torneotruco.cba+envidito@gmail.com",
    ],
  },
];

export default function TerminosPage() {
  return <LegalDoc title="Términos y Condiciones de Uso de Envidito" lastUpdated="29/07/2026" sections={SECTIONS} />;
}
