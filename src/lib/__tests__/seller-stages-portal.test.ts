import { describe, expect, it } from 'vitest'
import {
  LOST_STAGE,
  MARKETING_VISITS_STAGE,
  NEW_CONTACT_STAGE,
  PROMISE_SIGNED_STAGE,
  SIGNED_MANDATE_STAGE,
  SOLD_STAGE,
  isSalesFollowUpStage,
} from '../market/seller-stages'

describe('isSalesFollowUpStage', () => {
  it("ouvre le suivi a la signature du mandat et ne le referme plus", () => {
    // Le trou historique : ces deux stades renvoyaient false, le vendeur perdait
    // son suivi pendant toute la commercialisation.
    expect(isSalesFollowUpStage(SIGNED_MANDATE_STAGE)).toBe(true)
    expect(isSalesFollowUpStage(MARKETING_VISITS_STAGE)).toBe(true)
    expect(isSalesFollowUpStage(PROMISE_SIGNED_STAGE)).toBe(true)
    expect(isSalesFollowUpStage(SOLD_STAGE)).toBe(true)
  })

  it('reste ferme avant le mandat', () => {
    expect(isSalesFollowUpStage(NEW_CONTACT_STAGE)).toBe(false)
    expect(isSalesFollowUpStage("Visite d'estimation")).toBe(false)
    expect(isSalesFollowUpStage("Remise de l'estimation")).toBe(false)
  })

  it('reste ferme sur un dossier perdu ou un stade inconnu', () => {
    expect(isSalesFollowUpStage(LOST_STAGE)).toBe(false)
    expect(isSalesFollowUpStage(null)).toBe(false)
    expect(isSalesFollowUpStage('Stade inexistant')).toBe(false)
  })
})
