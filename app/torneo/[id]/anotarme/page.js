import { supabase } from "../../../../lib/supabaseClient";
import AnotarmeClient from "./AnotarmeClient";

export async function generateMetadata({ params }) {
  const { id } = params;
  const { data } = await supabase.from("tournaments").select("nombre, ubicacion, fecha").eq("id", id).single();

  const nombre = data?.nombre || "Envidito";
  const detalle = [data?.ubicacion, data?.fecha].filter(Boolean).join(" · ");
  const descripcion = detalle ? `Anotate para jugar — ${detalle}.` : "Anotate para jugar este torneo.";

  return {
    title: nombre,
    openGraph: {
      title: nombre,
      description: descripcion,
      url: `/torneo/${id}/anotarme`,
    },
    twitter: {
      card: "summary_large_image",
      title: nombre,
      description: descripcion,
    },
  };
}

export default function Page({ params }) {
  return <AnotarmeClient params={params} />;
}
