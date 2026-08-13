import { describe, expect, it } from 'vitest'
import { buildSellerMilestones } from '../market/seller-milestones'
import {
  ESTIMATION_DELIVERED_STAGE,
  MARKETING_VISITS_STAGE,
  PROMISE_SIGNED_STAGE,
  SIGNED_MANDATE_STAGE,
  SOLD_STAGE,
} from '../market/seller-stages'

const base = {
  stage: ESTIMATION_DELIVERED_STAGE,
  mandateSignedAt: null,
  estimationPublished: false,
  estimationPublishedAt: null,
}

/** Raccourci de lecture : "done done in_progress todo todo". */
function shape(input: Parameters<typeof buildSellerMilestones>[0]) {
  return buildSellerMilestones(input)
    .map((milestone) => milestone.status)
    .join(' ')
}

describe('buildSellerMilestones', () => {
  it('expose toujours les cinq jalons dans l ordre', () => {
    expect(buildSellerMilestones(base).map((m) => m.key)).toEqual([
      'estimation',
      'mandat',
      'annonce',
      'compromis',
      'acte',
    ])
  })

  it('marque en cours le premier jalon non franchi', () => {
    expect(shape(base)).toBe('in_progress todo todo todo todo')
  })

  it('avance au fil du pipeline', () => {
    expect(shape({ ...base, estimationPublished: true })).toBe('done in_progress todo todo todo')
    expect(
      shape({ ...base, estimationPublished: true, stage: SIGNED_MANDATE_STAGE })
    ).toBe('done done in_progress todo todo')
    expect(
      shape({ ...base, estimationPublished: true, stage: MARKETING_VISITS_STAGE })
    ).toBe('done done done in_progress todo')
    expect(
      shape({ ...base, estimationPublished: true, stage: PROMISE_SIGNED_STAGE })
    ).toBe('done done done done in_progress')
    expect(shape({ ...base, estimationPublished: true, stage: SOLD_STAGE })).toBe(
      'done done done done done'
    )
  })

  it('ne remonte pas un jalon saute au rang de jalon courant', () => {
    // Cas reel : mandat signe, voire compromis, alors que l'estimation n'a
    // jamais ete publiee au client. Le jalon manquant reste « a faire » — le
    // jalon courant est celui qui suit le dernier franchi, sinon le vendeur
    // lirait « Estimation remise — en cours » devant des jalons termines.
    expect(shape({ ...base, stage: SIGNED_MANDATE_STAGE })).toBe(
      'todo done in_progress todo todo'
    )
    expect(shape({ ...base, stage: PROMISE_SIGNED_STAGE })).toBe(
      'todo done done done in_progress'
    )
  })

  it('ne porte une date que lorsque la base la connait', () => {
    const milestones = buildSellerMilestones({
      stage: SIGNED_MANDATE_STAGE,
      mandateSignedAt: '2026-03-04T00:00:00.000Z',
      estimationPublished: true,
      estimationPublishedAt: '2026-02-01T00:00:00.000Z',
    })
    const byKey = Object.fromEntries(milestones.map((m) => [m.key, m]))

    expect(byKey.estimation.completed_at).toBe('2026-02-01T00:00:00.000Z')
    expect(byKey.mandat.completed_at).toBe('2026-03-04T00:00:00.000Z')
    // Aucune colonne ne date la mise en ligne : on n'invente pas.
    expect(byKey.annonce.completed_at).toBeNull()
  })

  it('n expose ni les visites ni les offres, qui ne sont pas des jalons', () => {
    const keys = buildSellerMilestones(base).map((m) => m.key)
    expect(keys).not.toContain('visite')
    expect(keys).not.toContain('offre')
  })
})
