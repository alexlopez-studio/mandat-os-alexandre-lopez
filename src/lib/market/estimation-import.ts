import type { Json } from '@/types/supabase'

export type MergeOptions = {
  overwriteEditorial: boolean
}

/**
 * Fusionne le payload d'un import d'estimation (skill Claude) dans un iad_report existant.
 * Fusion par sous-clé, jamais par remplacement total : ne touche que les sections
 * apportées par l'import (socio_economic, market.distribution/trend/tension,
 * comparables.competing/unsold, positioning étendu, synthesis, track_record).
 * Les 3 champs éditoriaux déjà rédigés manuellement (property.title/strengths/objections,
 * conclusion.text) ne sont écrasés que s'ils sont vides ou si overwriteEditorial est vrai.
 */
export function mergeIadReportFromImport(
  existingReport: Record<string, Json | undefined>,
  payload: Record<string, unknown>,
  options: MergeOptions,
): Record<string, Json | undefined> {
  const existingMarket = asRecord(existingReport.market)
  const payloadMarket = asRecord(payload.market)
  const existingComparables = asRecord(existingReport.comparables)
  const payloadComparables = asRecord(payload.comparables)
  const existingPositioning = asRecord(existingReport.positioning)
  const payloadPositioning = asRecord(payload.positioning)
  const existingProperty = asRecord(existingReport.property)
  const payloadProperty = asRecord(payload.property)
  const existingConclusion = asRecord(existingReport.conclusion)
  const payloadConclusion = asRecord(payload.conclusion)
  const existingIadProof = asRecord(existingReport.iad_proof)

  const trackRecord = isNonEmptyArray(payload.track_record) ? (payload.track_record as Json) : existingReport.track_record

  const strengths = shouldOverwrite(existingProperty.strengths, options.overwriteEditorial)
    ? (payloadProperty.strengths ?? existingProperty.strengths)
    : existingProperty.strengths
  const objections = shouldOverwrite(existingProperty.objections, options.overwriteEditorial)
    ? (payloadProperty.objections ?? existingProperty.objections)
    : existingProperty.objections
  const title = shouldOverwriteText(existingProperty.title, options.overwriteEditorial)
    ? (payloadProperty.title ?? existingProperty.title)
    : existingProperty.title
  const conclusionText = shouldOverwriteText(existingConclusion.text, options.overwriteEditorial)
    ? (payloadConclusion.text ?? existingConclusion.text)
    : existingConclusion.text

  return {
    ...existingReport,
    socio_economic: isNonEmptyRecord(payload.socio_economic) ? (payload.socio_economic as Json) : existingReport.socio_economic,
    synthesis: isNonEmptyRecord(payload.synthesis) ? (payload.synthesis as Json) : existingReport.synthesis,
    track_record: trackRecord,
    market: {
      ...existingMarket,
      distribution: isNonEmptyRecord(payloadMarket.distribution) ? payloadMarket.distribution : existingMarket.distribution,
      trend: isNonEmptyRecord(payloadMarket.trend) ? payloadMarket.trend : existingMarket.trend,
      tension: isNonEmptyRecord(payloadMarket.tension) ? payloadMarket.tension : existingMarket.tension,
    } as Json,
    comparables: {
      ...existingComparables,
      competing: isNonEmptyArray(payloadComparables.competing) ? payloadComparables.competing : existingComparables.competing,
      unsold: isNonEmptyArray(payloadComparables.unsold) ? payloadComparables.unsold : existingComparables.unsold,
    } as Json,
    positioning: {
      ...existingPositioning,
      price_per_sqm_rank: payloadPositioning.price_per_sqm_rank ?? existingPositioning.price_per_sqm_rank,
      total_competitors: payloadPositioning.total_competitors ?? existingPositioning.total_competitors,
      cheaper_and_larger_percent: payloadPositioning.cheaper_and_larger_percent ?? existingPositioning.cheaper_and_larger_percent,
      thresholds: isNonEmptyRecord(payloadPositioning.thresholds) ? payloadPositioning.thresholds : existingPositioning.thresholds,
      average_competitor_price_per_sqm: payloadPositioning.average_competitor_price_per_sqm ?? existingPositioning.average_competitor_price_per_sqm,
    } as Json,
    property: {
      ...existingProperty,
      title,
      strengths,
      objections,
    } as Json,
    conclusion: {
      ...existingConclusion,
      text: conclusionText,
    } as Json,
    iad_proof: {
      ...existingIadProof,
      sold_properties: trackRecord ?? existingIadProof.sold_properties,
    } as Json,
  }
}

function shouldOverwrite(existingValue: Json | undefined, overwriteEditorial: boolean) {
  if (overwriteEditorial) return true
  return !Array.isArray(existingValue) || existingValue.length === 0
}

function shouldOverwriteText(existingValue: Json | undefined, overwriteEditorial: boolean) {
  if (overwriteEditorial) return true
  return typeof existingValue !== 'string' || existingValue.trim() === ''
}

function isNonEmptyRecord(value: unknown): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length > 0
}

function isNonEmptyArray(value: unknown): value is Json[] {
  return Array.isArray(value) && value.length > 0
}

function asRecord(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : {}
}
