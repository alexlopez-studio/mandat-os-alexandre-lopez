import { redirect } from 'next/navigation'

// La rubrique « Clients » est fusionnée dans « Opportunités / Mandats » :
// le suivi du dossier vit désormais dans la fiche opportunité / acquéreur.
export default function ClientsRedirectPage() {
  redirect('/app/opportunities')
}
