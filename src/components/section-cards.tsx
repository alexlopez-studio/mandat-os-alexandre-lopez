import {
  BellRingIcon,
  HomeIcon,
  RadarIcon,
  TrendingUpIcon,
} from "lucide-react"

import { MetricCard } from "@/components/pro"

export function SectionCards() {
  const metrics = [
    {
      label: "Biens surveilles",
      value: "1 248",
      detail: "Zones Provence Verte et Verdon actives",
      trend: "+8%",
      icon: HomeIcon,
      tone: "brand" as const,
    },
    {
      label: "Opportunites chaudes",
      value: "37",
      detail: "Signaux prix, duree et republication",
      trend: "12 a traiter",
      icon: RadarIcon,
      tone: "warning" as const,
    },
    {
      label: "Alertes envoyees",
      value: "18",
      detail: "Fenetre d'or detectee cette semaine",
      trend: "+5",
      icon: BellRingIcon,
      tone: "success" as const,
    },
    {
      label: "Taux de qualification",
      value: "64%",
      detail: "Biens classes avec score exploitable",
      trend: "+11 pts",
      icon: TrendingUpIcon,
      tone: "neutral" as const,
    },
  ]

  return (
    <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-3 md:gap-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  )
}
